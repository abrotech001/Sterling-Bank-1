// @ts-nocheck
// @ts-nocheck
import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, usersTable, walletsTable, notificationsTable } from "@workspace/db";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { comparePin } from "../lib/auth";
import { sendTransactionAlert, sendGiftCardAlert } from "../lib/telegram";
import { broadcastToUser } from "../lib/websocket";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { limit = "100", offset = "0" } = req.query as Record<string, string>;

  try {
    const senderAlias = aliasedTable(usersTable, "sender");
    const receiverAlias = aliasedTable(usersTable, "receiver");

    const rows = await db.select({
      tx: transactionsTable,
      senderUsername: senderAlias.username,
      senderFirstName: senderAlias.firstName,
      senderLastName: senderAlias.lastName,
      senderAccount: senderAlias.accountNumber,
      receiverUsername: receiverAlias.username,
      receiverFirstName: receiverAlias.firstName,
      receiverLastName: receiverAlias.lastName,
      receiverAccount: receiverAlias.accountNumber,
    }).from(transactionsTable)
      .leftJoin(senderAlias, eq(transactionsTable.senderId, senderAlias.id))
      .leftJoin(receiverAlias, eq(transactionsTable.receiverId, receiverAlias.id))
      .where(or(eq(transactionsTable.senderId, userId), eq(transactionsTable.receiverId, userId)))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    const total = await db.select({ count: sql<number>`count(*)` })
      .from(transactionsTable)
      .where(or(eq(transactionsTable.senderId, userId), eq(transactionsTable.receiverId, userId)));

    const transactions = rows.map((r) => {
      const tx = r.tx;
      const isOutgoing =
        tx.senderId === userId &&
        tx.type !== "deposit" &&
        tx.type !== "admin_fund" &&
        tx.type !== "gift_card";
      const direction: "incoming" | "outgoing" = isOutgoing ? "outgoing" : "incoming";
      const label = direction === "outgoing" ? "Sent" : "Received";

      let counterpartyName: string | null = null;
      let counterpartyAccount: string | null = null;
      if (tx.type === "transfer") {
        if (direction === "outgoing") {
          counterpartyName = [r.receiverFirstName, r.receiverLastName].filter(Boolean).join(" ") || (r.receiverUsername ? `@${r.receiverUsername}` : null);
          counterpartyAccount = r.receiverAccount;
        } else {
          counterpartyName = [r.senderFirstName, r.senderLastName].filter(Boolean).join(" ") || (r.senderUsername ? `@${r.senderUsername}` : null);
          counterpartyAccount = r.senderAccount;
        }
      } else if (tx.type === "admin_fund") {
        counterpartyName = "Crestfield Bank";
      } else if (tx.type === "gift_card") {
        counterpartyName = tx.method ? `${tx.method} Gift Card` : "Gift Card";
      } else if (tx.type === "deposit") {
        counterpartyName = tx.method ? `${tx.method.toUpperCase()} Deposit` : "Deposit";
      } else if (tx.type === "withdrawal") {
        counterpartyName = tx.bankName || tx.destination || "External Account";
      }

      return {
        id: tx.id,
        type: tx.type,
        amount: parseFloat(tx.amount),
        status: tx.status,
        note: tx.note,
        description: tx.note,
        declineReason: tx.declineReason,
        senderId: tx.senderId,
        receiverId: tx.receiverId,
        method: tx.method,
        destination: tx.destination,
        direction,
        label,
        counterpartyName,
        counterpartyAccount,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      };
    });

    res.json({ transactions, total: parseInt(total[0]?.count.toString() || "0") });
  } catch (e) {
    req.log.error({ e }, "Error getting transactions");
    res.status(500).json({ error: "Failed to get transactions" });
  }
});

router.get("/lookup-recipient/:accountNumber", requireAuth, async (req, res) => {
  const accountNumber = String(req.params.accountNumber ?? "").trim();
  const userId = req.userId!;
  if (!accountNumber) {
    res.status(400).json({ error: "Account number is required" });
    return;
  }
  try {
    const [recipient] = await db.select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      username: usersTable.username,
      accountNumber: usersTable.accountNumber,
      status: usersTable.status,
    }).from(usersTable).where(eq(usersTable.accountNumber, accountNumber));

    if (!recipient) {
      res.status(404).json({ error: "No Crestfield account matches that number" });
      return;
    }
    if (recipient.id === userId) {
      res.status(400).json({ error: "You cannot transfer to your own account" });
      return;
    }
    if (recipient.status === "frozen") {
      res.status(400).json({ error: "This account cannot receive transfers right now" });
      return;
    }
    const fullName = [recipient.firstName, recipient.lastName].filter(Boolean).join(" ") || recipient.username;
    res.json({
      recipient: {
        accountNumber: recipient.accountNumber,
        fullName,
        username: recipient.username,
      },
    });
  } catch (e) {
    req.log.error({ e }, "Error looking up recipient");
    res.status(500).json({ error: "Failed to look up account" });
  }
});

router.post("/transfer", requireAuth, async (req, res) => {
  const recipientAccountNumber: string | undefined =
    req.body.recipientAccountNumber || req.body.toAccountNumber;
  const rawAmount = req.body.amount;
  const pin: string | undefined = req.body.pin;
  const note: string | undefined = (req.body.note ?? req.body.description ?? "").toString().trim();
  const userId = req.userId!;
  const user = req.user!;

  if (!recipientAccountNumber || rawAmount === undefined || rawAmount === null || rawAmount === "") {
    res.status(400).json({ error: "Recipient and amount are required" });
    return;
  }

  const amountNum = typeof rawAmount === "number" ? rawAmount : parseFloat(String(rawAmount));
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    res.status(400).json({ error: "Amount must be a positive number" });
    return;
  }
  if (amountNum > 1_000_000) {
    res.status(400).json({ error: "Amount exceeds the per-transfer limit" });
    return;
  }
  const amount = amountNum.toFixed(2);

  if (!note) {
    res.status(400).json({ error: "A narration / description is required for every transfer" });
    return;
  }

  if (user.pinHash) {
    if (!pin) {
      res.status(400).json({ error: "Transaction PIN is required" });
      return;
    }
    const validPin = await comparePin(pin, user.pinHash);
    if (!validPin) {
      res.status(401).json({ error: "Invalid transaction PIN" });
      return;
    }
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

    if (recipient.status && recipient.status !== "active") {
      res.status(400).json({ error: "Recipient account is not active" });
      return;
    }

    const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
    // We check if they have enough balance (ignoring pending to prevent double-spending)
    if (!wallet || parseFloat(wallet.balance) < parseFloat(amount)) {
      res.status(400).json({ error: "Insufficient funds" });
      return;
    }

    // 1. Lock the money into the Pending Balance so the UI badge shows it
    await db.update(walletsTable)
      .set({
        pendingBalance: sql`${walletsTable.pendingBalance} + ${amount}`,
        updatedAt: new Date()
      })
      .where(eq(walletsTable.userId, userId));

    // 2. Create the transaction as PENDING (This sends it to your Web Admin Dashboard)
    const [tx] = await db.insert(transactionsTable).values({
      type: "transfer",
      amount: parseFloat(amount).toString(),
      status: "pending", 
      senderId: userId,
      receiverId: recipient.id,
      note: note || null,
    }).returning();

    // 3. Removed the Telegram Alert completely as requested!
    // It will now just quietly wait in your Web Dashboard Approvals tab.

    // 4. Update the user's app live so they see the Pending badge appear
    broadcastToUser(userId, { type: "balance_update", data: { transactionId: tx.id } });

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
