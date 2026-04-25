import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, walletsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { comparePin } from "../lib/auth";
import { sendGiftCardAlert } from "../lib/telegram";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  const { brand, code, amount, frontImage, backImage, pin } = req.body;
  const userId = req.userId!;
  const user = req.user!;

  if (!brand || !code || !amount || !frontImage || !pin) {
    res.status(400).json({ error: "Brand, code, amount, front image, and PIN are required" });
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
    const [tx] = await db.insert(transactionsTable).values({
      type: "gift_card",
      amount: parseFloat(amount).toString(),
      status: "pending",
      receiverId: userId,
      note: `Gift card: ${brand} - Code: ${code}${backImage ? " (with back image)" : ""}`,
      method: brand,
      destination: code,
    }).returning();

    const msgId = await sendGiftCardAlert(
      tx.id,
      userId,
      user.username,
      brand,
      code,
      parseFloat(amount).toFixed(2)
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
        receiverId: tx.receiverId,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      },
      message: "Gift card submitted for review. Funds will be credited once verified.",
    });
  } catch (e) {
    req.log.error({ e }, "Error submitting gift card");
    res.status(500).json({ error: "Failed to submit gift card" });
  }
});

export default router;
