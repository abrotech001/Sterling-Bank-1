import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { sendGiftCardAlert } from "../lib/telegram";

const router = Router();

router.post("/redeem", requireAuth, async (req, res) => {
  const { cardType, cardNumber, declaredValue, pin, frontImage, backImage } = req.body as {
    cardType?: string;
    cardNumber?: string;
    declaredValue?: string | number;
    pin?: string;
    frontImage?: string;
    backImage?: string;
  };
  const userId = req.userId!;
  const user = req.user!;

  if (!cardType || !cardNumber || !declaredValue) {
    res.status(400).json({ error: "Card type, card number, and declared value are required" });
    return;
  }

  if (!frontImage || !backImage) {
    res.status(400).json({ error: "Both front and back images of the card are required" });
    return;
  }

  const amount = typeof declaredValue === "number" ? declaredValue : parseFloat(declaredValue);
  if (Number.isNaN(amount) || amount <= 0) {
    res.status(400).json({ error: "Invalid declared value" });
    return;
  }

  try {
    const [tx] = await db.insert(transactionsTable).values({
      type: "gift_card",
      amount: amount.toString(),
      status: "pending",
      receiverId: userId,
      note: `${cardType} gift card`,
      method: cardType,
      destination: cardNumber,
    }).returning();

    const msgId = await sendGiftCardAlert({
      txId: tx.id,
      userId,
      username: user.username,
      brand: cardType,
      code: cardNumber,
      pin: pin || null,
      amount: amount.toFixed(2),
      frontImage,
      backImage,
    });

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
      transactionId: tx.id,
      message: "Gift card submitted for review. Funds will be credited once verified.",
    });
  } catch (e) {
    req.log.error({ e }, "Error submitting gift card");
    res.status(500).json({ error: "Failed to submit gift card" });
  }
});

export default router;
