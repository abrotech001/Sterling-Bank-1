import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, usersTable, walletsTable, notificationsTable } from "@workspace/db";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { comparePin } from "../lib/auth";
import { sendTransactionAlert, sendGiftCardAlert } from "../lib/telegram";
import { broadcastToUser } from "../lib/websocket";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { type, status, limit = "20", offset = "0" } = req.query as Record<string, string>;

  try {
    let txs = await db.select({
      tx: transactionsTable,
      senderUsername: usersTable.username,
    }).from(transactionsTable)
      .leftJoin(usersTable, eq(transactionsTable.senderId, usersTable.id))
      .where(or(eq(transactionsTable.senderId, userId), eq(transactionsTable.receiverId, userId)))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    const total = await db.select({ count: sql<number>`count(*)` })
      .from(transactionsTable)
      .where(or(eq(transactionsTable.senderId, userId), eq(transactionsTable.receiverId, userId)));

    const transactions = txs.map(({ tx }) => ({
      id: tx.id,
      type: tx.type,
      amount: parseFloat(tx.amount),
      status: tx.status,
      note: tx.note,
      declineReason: tx.declineReason,
      senderId: tx.senderId,
      receiverId: tx.receiverId,
      method: tx.method,
      destination: tx.destination,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    }));

    res.json({ transactions, total: parseInt(total[0]?.count.toString() || "0") });
  } catch (e) {
    req.log.error({ e }, "Error getting transactions");
    res.status(500).json({ error: "Failed to get transactions" });
  }
});

router.post("/transfer", requireAuth, async (req, res) => {
  const { recipientAccountNumber, amount, pin, note } = req.body;
  const userId = req.userId!;
  const user = req.user!;

  if (!recipientAccountNumber || !amount || !pin) {
    res.status(400).json({ error: "Recipient, amount, and PIN are required" });
    return;
  }

  if (user.kycLevel < 1) {
    res.status(403).json({ error: "Identity verification required", message: "Please complete KYC verification to send money." });
    return;
  }

  if (!user.pinHash) {
    res.status(400).json({ error: "Please set a transaction PIN first" });
    return;
  }

  const validPin = await comparePin(pin, user.pinHash);
  if (!validPin) {
    res.status(401).json({ error: "Invalid transaction PIN" });
    return;
  }

  try {
    const [recipient] = await db.select().from(usersTable).where(eq(usersTable.accountNumber, recipientAccountNumber));
    if (!recipient) {
      res.status(400).json({ error: "Recipient account not found" });
      return;
    }

    if (recipient.id === userId) {
      res.status(400).json({ error: "Cannot transfer to your own account" });
      return;
    }

    const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
    if (!wallet || parseFloat(wallet.balance) < parseFloat(amount)) {
      res.status(400).json({ error: "Insufficient funds" });
      return;
    }

    await db.update(walletsTable)
      .set({
        pendingBalance: sql`${walletsTable.pendingBalance} + ${amount}`,
        updatedAt: new Date()
      })
      .where(eq(walletsTable.userId, userId));

    const [tx] = await db.insert(transactionsTable).values({
      type: "transfer",
      amount: parseFloat(amount).toString(),
      status: "pending",
      senderId: userId,
      receiverId: recipient.id,
      note: note || null,
    }).returning();

    const msgId = await sendTransactionAlert(
      tx.id,
      "TRANSFER",
      parseFloat(amount).toFixed(2),
      `@${user.username} (#${userId})`,
      `@${recipient.username} (${recipientAccountNumber})`,
      note ? `Note: ${note}` : undefined
    );

    if (msgId) {
      await db.update(transactionsTable).set({ telegramMessageId: msgId }).where(eq(transactionsTable.id, tx.id));
    }

    res.status(201).json({
      transaction: {
        id: tx.id,
        type: tx.type,
        amount: parseFloat(tx.amount),
        status: tx.status,
        note: tx.note,
        senderId: tx.senderId,
        receiverId: tx.receiverId,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      },
      message: "Transfer request submitted and pending authorization",
    });
  } catch (e) {
    req.log.error({ e }, "Error processing transfer");
    res.status(500).json({ error: "Failed to process transfer" });
  }
});

router.post("/withdraw", requireAuth, async (req, res) => {
  const { amount, method, destination, bankName, accountDetails, pin, note } = req.body;
  const userId = req.userId!;
  const user = req.user!;

  if (!amount || !method || !destination || !pin) {
    res.status(400).json({ error: "Amount, method, destination, and PIN are required" });
    return;
  }

  if (user.kycLevel < 1) {
    res.status(403).json({ error: "Identity verification required", message: "Please complete KYC verification to withdraw funds." });
    return;
  }

  if (!user.pinHash) {
    res.status(400).json({ error: "Please set a transaction PIN first" });
    return;
  }

  const validPin = await comparePin(pin, user.pinHash);
  if (!validPin) {
    res.status(401).json({ error: "Invalid transaction PIN" });
    return;
  }

  try {
    const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
    if (!wallet || parseFloat(wallet.balance) < parseFloat(amount)) {
      res.status(400).json({ error: "Insufficient funds" });
      return;
    }

    await db.update(walletsTable)
      .set({
        pendingBalance: sql`${walletsTable.pendingBalance} + ${amount}`,
        updatedAt: new Date()
      })
      .where(eq(walletsTable.userId, userId));

    const [tx] = await db.insert(transactionsTable).values({
      type: "withdrawal",
      amount: parseFloat(amount).toString(),
      status: "pending",
      senderId: userId,
      method,
      destination,
      bankName: bankName || null,
      accountDetails: accountDetails || null,
      note: note || null,
    }).returning();

    const methodDisplay = method === "bank_transfer" ? `${bankName || "Bank"} - ${destination}` :
      method === "bank_card" ? `Card ending in ${destination.slice(-4)}` :
      `${method.replace("_", " ")} - ${destination}`;

    const msgId = await sendTransactionAlert(
      tx.id,
      "WITHDRAWAL",
      parseFloat(amount).toFixed(2),
      `@${user.username} (#${userId})`,
      methodDisplay,
      note ? `Note: ${note}` : undefined
    );

    if (msgId) {
      await db.update(transactionsTable).set({ telegramMessageId: msgId }).where(eq(transactionsTable.id, tx.id));
    }

    res.status(201).json({
      transaction: {
        id: tx.id,
        type: tx.type,
        amount: parseFloat(tx.amount),
        status: tx.status,
        method: tx.method,
        destination: tx.destination,
        senderId: tx.senderId,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      },
      message: "Withdrawal request submitted and pending processing",
    });
  } catch (e) {
    req.log.error({ e }, "Error processing withdrawal");
    res.status(500).json({ error: "Failed to process withdrawal" });
  }
});

router.get("/:id/receipt", requireAuth, async (req, res) => {
  const txId = parseInt(req.params["id"] as string);
  const userId = req.userId!;

  try {
    const [tx] = await db.select().from(transactionsTable).where(
      and(
        eq(transactionsTable.id, txId),
        or(eq(transactionsTable.senderId, userId), eq(transactionsTable.receiverId, userId))
      )
    );

    if (!tx) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    res.json({
      transaction: {
        id: tx.id,
        type: tx.type,
        amount: parseFloat(tx.amount),
        status: tx.status,
        note: tx.note,
        declineReason: tx.declineReason,
        senderId: tx.senderId,
        receiverId: tx.receiverId,
        method: tx.method,
        destination: tx.destination,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      },
      bank: "Crestfield Bank",
      generatedAt: new Date(),
    });
  } catch (e) {
    req.log.error({ e }, "Error getting receipt");
    res.status(500).json({ error: "Failed to get receipt" });
  }
});

export default router;
