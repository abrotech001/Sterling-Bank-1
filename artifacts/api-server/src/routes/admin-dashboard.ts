import { Router } from "express";
import { db, usersTable, walletsTable, transactionsTable, kycTable, adminLogsTable, notificationsTable } from "@workspace/db";
// 🚨 Notice I added 'or' to the imports here!
import { eq, sql, and, desc, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/admin.js";
import { broadcastToUser } from "../lib/websocket.js";

const router = Router();

// Secure the entire dashboard
router.use(requireAuth);
router.use(requireAdmin);

// ==========================================
// 1. GET ALL USERS & BALANCES
// ==========================================
router.get("/users", async (req, res) => {
  try {
    const users = await db.execute(sql`
      SELECT u.id, u.username, u.email, u.status, COALESCE(w.balance, '0.00') as balance
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      ORDER BY u.id DESC
      LIMIT 50
    `);
    res.json(users.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ==========================================
// 2. USER ACTIONS (Freeze, Unfreeze, Fund, Delete)
// ==========================================
router.post("/users/:userId/action", async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { action, amount, reason } = req.body;

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    if (action === "freeze" || action === "unfreeze") {
      const newStatus = action === "freeze" ? "frozen" : "active";
      await db.update(usersTable).set({ status: newStatus }).where(eq(usersTable.id, userId));
      await db.insert(adminLogsTable).values({ action: `${action}_user`, targetUserId: userId, details: `User ${action} via Web Dashboard` });
      
      broadcastToUser(userId, { type: "account_status", data: { status: newStatus } });
      return res.json({ success: true, message: `User ${action}d successfully` });
    }

    if (action === "fund") {
      const fundAmount = parseFloat(amount);
      if (isNaN(fundAmount) || fundAmount <= 0) return res.status(400).json({ error: "Invalid amount" });

      await db.update(walletsTable).set({ balance: sql`balance + ${fundAmount}`, updatedAt: new Date() }).where(eq(walletsTable.userId, userId));
      
      const [tx] = await db.insert(transactionsTable).values({
        type: "admin_fund", amount: fundAmount.toString(), status: "completed", receiverId: userId, note: reason || "Admin Funding",
      }).returning();

      await db.insert(notificationsTable).values({
        userId, type: "transaction", title: "Account Credited", message: `$${fundAmount.toFixed(2)} has been credited. Narration: ${reason}`,
      });

      await db.insert(adminLogsTable).values({ action: "fund_user", targetUserId: userId, details: `Funded $${fundAmount} via Web Dashboard` });
      broadcastToUser(userId, { type: "balance_update", data: { transactionId: tx.id } });
      
      return res.json({ success: true, message: "Funds added successfully" });
    }

    // 🚨 THE NEW BULLETPROOF DELETE SEQUENCE 🚨
    if (action === "delete") {
      try {
        // 1. Wipe Notifications
        await db.delete(notificationsTable).where(eq(notificationsTable.userId, userId));
        
        // 2. Wipe Transactions (where they sent OR received money)
        await db.delete(transactionsTable).where(
          or(
            eq(transactionsTable.senderId, userId),
            eq(transactionsTable.receiverId, userId)
          )
        );

        // 3. Wipe Admin Logs targeting this user
        await db.delete(adminLogsTable).where(eq(adminLogsTable.targetUserId, userId));

        // 4. Wipe KYC Records
        await db.delete(kycTable).where(eq(kycTable.userId, userId));

        // 5. Wipe Wallet
        await db.delete(walletsTable).where(eq(walletsTable.userId, userId));

        // (NOTE: If you get a 500 error again because of the Crypto wallet feature, 
        // uncomment these two lines below to wipe their crypto data too!)
        // await db.execute(sql`DELETE FROM crypto_swaps WHERE user_id = ${userId}`);
        // await db.execute(sql`DELETE FROM crypto_wallets WHERE user_id = ${userId}`);

        // 6. FINALLY, Delete the User
        await db.delete(usersTable).where(eq(usersTable.id, userId));

        // Log the action (targetUserId is null because the user is gone)
        await db.insert(adminLogsTable).values({ 
          action: "delete_user", 
          details: `Permanently deleted user #${userId} and all associated data.` 
        });

        return res.json({ success: true, message: "User deleted" });
      } catch (dbError: any) {
        // If the database still blocks it, this will tell us EXACTLY which table is causing it
        console.error("Database constraint block:", dbError.message);
        return res.status(500).json({ error: "DB Constraint", details: dbError.message });
      }
    }

    res.status(400).json({ error: "Invalid action" });
  } catch (error) {
    console.error("Action error:", error);
    res.status(500).json({ error: "Action failed" });
  }
});

// ==========================================
// 3. GET PENDING APPROVALS (The Queue)
// ==========================================
router.get("/pending", async (req, res) => {
  try {
    const pendingTxs = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.status, "pending"));
    
    const pendingKyc = await db.select()
      .from(kycTable)
      .where(eq(kycTable.status, "pending"));

    const tasks = [
      ...pendingTxs.map(tx => ({
        id: tx.id,
        type: "transaction",
        title: `${(tx.type || "Unknown").toUpperCase()} Request`,
        subtitle: `User #${tx.senderId || tx.receiverId || "N/A"}`,
        amount: `$${tx.amount}`,
        date: tx.createdAt || new Date().toISOString()
      })),
      ...pendingKyc.map(k => ({
        id: k.id,
        type: "kyc",
        title: `KYC Tier ${k.tier || 2} Verification`,
        subtitle: `Name: ${k.fullName || "Unknown"}`,
        date: k.createdAt || new Date().toISOString()
      }))
    ];

    tasks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(tasks);
  } catch (error: any) {
    console.error("CRASH IN /pending:", error);
    res.status(500).json({ 
      error: "Failed to fetch tasks", 
      details: error.message,
      stack: error.stack 
    });
  }
});

// ==========================================
// 4. RESOLVE PENDING TASKS (Accept/Decline)
// ==========================================
router.post("/tasks/resolve", async (req, res) => {
  const { id, type, action } = req.body; 
  const isApprove = action === "approve";

  try {
    if (type === "transaction") {
      const nextStatus = isApprove ? "completed" : "failed";
      const [tx] = await db.update(transactionsTable).set({ 
        status: nextStatus, 
        updatedAt: new Date(),
        ...(isApprove ? {} : { declineReason: "Declined by Admin via Dashboard" }) 
      }).where(and(eq(transactionsTable.id, id), eq(transactionsTable.status, "pending"))).returning();

      if (!tx) return res.status(404).json({ error: "Transaction not found or already processed" });

      if (tx.senderId) {
        const [senderWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, tx.senderId));
        
        if (senderWallet) {
          const currentPending = parseFloat(senderWallet.pendingBalance?.toString() || "0");
          const txAmount = parseFloat(tx.amount?.toString() || "0");
          const newPending = Math.max(0, currentPending - txAmount).toString();

          if (isApprove) {
            await db.update(walletsTable).set({ 
              balance: sql`${walletsTable.balance} - ${tx.amount}`,
              pendingBalance: newPending 
            }).where(eq(walletsTable.userId, tx.senderId));

            if (tx.type === "transfer" && tx.receiverId) {
              await db.update(walletsTable).set({ 
                balance: sql`${walletsTable.balance} + ${tx.amount}` 
              }).where(eq(walletsTable.userId, tx.receiverId));
            }
          } else {
            await db.update(walletsTable).set({ 
              pendingBalance: newPending 
            }).where(eq(walletsTable.userId, tx.senderId));
          }
        }
      }

      await db.insert(adminLogsTable).values({ action: `${action}_transaction`, details: `${action} TX #${id} via Web` });
      if (tx.senderId) broadcastToUser(tx.senderId, { type: "transaction_update", data: { transactionId: tx.id, status: nextStatus } });
      
      return res.json({ success: true });
    }

    if (type === "kyc") {
      const nextStatus = isApprove ? "approved" : "rejected";
      const [kyc] = await db.update(kycTable).set({ status: nextStatus, reviewedAt: new Date() }).where(eq(kycTable.id, id)).returning();
      if (!kyc) return res.status(404).json({ error: "KYC not found" });

      if (isApprove) {
        const newLevel = kyc.tier === 3 ? 2 : 1;
        await db.update(usersTable).set({ kycLevel: newLevel }).where(eq(usersTable.id, kyc.userId));
      }

      await db.insert(adminLogsTable).values({ action: `${action}_kyc`, details: `${action} KYC #${id} via Web` });
      broadcastToUser(kyc.userId, { type: "kyc_update", data: { status: nextStatus } });
      
      return res.json({ success: true });
    }

    res.status(400).json({ error: "Unknown task type" });
  } catch (error) {
    console.error("Task resolve error:", error);
    res.status(500).json({ error: "Failed to resolve task" });
  }
});

// ==========================================
// 5. GET SYSTEM LOGS
// ==========================================
router.get("/logs", async (req, res) => {
  try {
    const logs = await db.select()
      .from(adminLogsTable)
      .orderBy(desc(adminLogsTable.createdAt))
      .limit(100);
    res.json(logs);
  } catch (error) {
    console.error("Logs fetch error:", error);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

export default router;
