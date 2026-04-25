import { Router } from "express";
import { db } from "@workspace/db";
import { cardsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getAdminBot } from "../lib/telegram";

const router = Router();

const NETWORK_PREFIXES: Record<string, string> = {
  visa: "4",
  mastercard: "5",
  amex: "37",
  discover: "60",
};

function generateCardNumber(network: string): string {
  const prefix = NETWORK_PREFIXES[network.toLowerCase()] || "4";
  const length = network.toLowerCase() === "amex" ? 15 : 16;
  let num = prefix;
  while (num.length < length) {
    num += Math.floor(Math.random() * 10).toString();
  }
  return num;
}

function generateCvv(network: string): string {
  const length = network.toLowerCase() === "amex" ? 4 : 3;
  let cvv = "";
  for (let i = 0; i < length; i++) cvv += Math.floor(Math.random() * 10).toString();
  return cvv;
}

function brandLabel(network: string): string {
  const map: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "Amex",
    discover: "Discover",
  };
  return map[network.toLowerCase()] || network;
}

function brandToNetwork(brand: string): string {
  const map: Record<string, string> = {
    Visa: "visa",
    Mastercard: "mastercard",
    Amex: "amex",
    Discover: "discover",
  };
  return map[brand] || brand.toLowerCase();
}

function shapeCard(c: typeof cardsTable.$inferSelect) {
  return {
    id: c.id,
    cardType: "debit",
    cardNetwork: brandToNetwork(c.brand),
    cardName: c.cardName || null,
    last4: c.last4,
    expiryMonth: parseInt(c.expiryMonth, 10) || 12,
    expiryYear: parseInt(c.expiryYear, 10) || new Date().getFullYear() + 4,
    cardholderName: c.cardHolderName,
    status: "active",
    isVirtual: true,
    createdAt: c.createdAt,
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const cards = await db.select().from(cardsTable).where(eq(cardsTable.userId, req.userId!));
    res.json({ cards: cards.map(shapeCard) });
  } catch (e) {
    req.log.error({ e }, "Error getting cards");
    res.status(500).json({ error: "Failed to get cards" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const { cardNetwork, cardholderName, cardType, cardName } = req.body;
  const userId = req.userId!;
  const user = req.user!;

  if (!cardholderName || !cardholderName.trim()) {
    res.status(400).json({ error: "Cardholder name is required" });
    return;
  }

  if (!cardName || !cardName.trim()) {
    res.status(400).json({ error: "Card name is required" });
    return;
  }

  const network = (cardNetwork || "visa").toLowerCase();
  if (!NETWORK_PREFIXES[network]) {
    res.status(400).json({ error: "Invalid card network" });
    return;
  }

  try {
    const cardNumber = generateCardNumber(network);
    const cvv = generateCvv(network);
    const last4 = cardNumber.slice(-4);
    const brand = brandLabel(network);
    const now = new Date();
    const expYear = now.getFullYear() + 4;
    const expMonth = (now.getMonth() + 1).toString().padStart(2, "0");
    const trimmedName = cardName.trim();

    const [card] = await db.insert(cardsTable).values({
      userId,
      cardHolderName: cardholderName.trim().toUpperCase(),
      cardName: trimmedName,
      cardNumberHash: cardNumber,
      last4,
      brand,
      expiryMonth: expMonth,
      expiryYear: expYear.toString(),
      cvvHash: cvv,
      rawCardNumber: cardNumber,
    }).returning();

    const adminBot = getAdminBot();
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || "";
    if (adminBot && adminChatId) {
      adminBot.sendMessage(adminChatId,
        `💳 NEW VIRTUAL CARD ISSUED\n\nUser: @${user.username} (ID: #${userId})\nName: ${trimmedName}\nType: ${cardType || "debit"} ${brand}\nNumber: ${cardNumber}\nCVV: ${cvv}\nExpiry: ${expMonth}/${expYear}\nHolder: ${cardholderName}`
      ).catch(() => {});
    }

    res.status(201).json({ card: shapeCard(card) });
  } catch (e) {
    req.log.error({ e }, "Error issuing card");
    res.status(500).json({ error: "Failed to issue card" });
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
