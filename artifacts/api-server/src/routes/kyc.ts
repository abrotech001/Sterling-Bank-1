// @ts-nocheck
import { Router } from "express";
import { db } from "@workspace/db";
import { kycTable, usersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { sendKycAlert } from "../lib/telegram";

const router = Router();

const TIER2_ID_TYPES = new Set(["passport", "national_id", "drivers_license", "residence_permit"]);
const TIER3_DOC_TYPES = new Set(["utility_bill", "bank_statement", "government_doc"]);

router.get("/status", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const user = req.user!;

  try {
    const submissions = await db.select().from(kycTable)
      .where(eq(kycTable.userId, userId))
      .orderBy(desc(kycTable.submittedAt));

    const lastTier2 = submissions.find((s) => s.tier === 2);
    const lastTier3 = submissions.find((s) => s.tier === 3);

    res.json({
      level: user.kycLevel,
      tier2: lastTier2 ? {
        status: lastTier2.status,
        rejectionReason: lastTier2.rejectionReason || undefined,
        submittedAt: lastTier2.submittedAt,
        reviewedAt: lastTier2.reviewedAt || undefined,
      } : { status: "not_started" },
      tier3: lastTier3 ? {
        status: lastTier3.status,
        rejectionReason: lastTier3.rejectionReason || undefined,
        submittedAt: lastTier3.submittedAt,
        reviewedAt: lastTier3.reviewedAt || undefined,
      } : { status: "not_started" },
    });
  } catch (e) {
    req.log.error({ e }, "Error getting KYC status");
    res.status(500).json({ error: "Failed to get KYC status" });
  }
});

router.post("/submit", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const user = req.user!;

  const rawTier = req.body.tier;
  const tier: number = rawTier === undefined || rawTier === null ? 2 : Number(rawTier);
  if (tier !== 2 && tier !== 3) {
    res.status(400).json({ error: "Invalid tier. Must be 2 or 3." });
    return;
  }

  const idType: string | undefined = req.body.idType || req.body.documentType;
  const idNumber: string | undefined = req.body.idNumber || req.body.documentNumber || (tier === 3 ? "N/A" : undefined);
  const idFrontImage: string | undefined =
    req.body.idFrontImage || req.body.frontImage || req.body.documentImage;
  const idBackImage: string | null =
    req.body.idBackImage || req.body.backImage || null;
  const selfieImage: string | null =
    req.body.selfieImage || req.body.selfie || null;

  const fullName: string =
    req.body.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username;
  const dateOfBirth: string = req.body.dateOfBirth || "Not provided";
  const address: string = req.body.address || user.country || "Not provided";

  if (!idType || !idNumber || !idFrontImage) {
    res.status(400).json({ error: "Document type, document number and image are required" });
    return;
  }

  if (tier === 2 && !TIER2_ID_TYPES.has(idType)) {
    res.status(400).json({ error: "Invalid identity document type" });
    return;
  }

  if (tier === 3 && !TIER3_DOC_TYPES.has(idType)) {
    res.status(400).json({ error: "Invalid address document type" });
    return;
  }

  if (tier === 2 && user.kycLevel >= 1) {
    res.status(400).json({ error: "Your identity has already been verified" });
    return;
  }

  if (tier === 3) {
    if (user.kycLevel < 1) {
      res.status(400).json({ error: "Complete identity verification (Tier 2) first" });
      return;
    }
    if (user.kycLevel >= 2) {
      res.status(400).json({ error: "Your address has already been verified" });
      return;
    }
  }

  try {
    const [existingPending] = await db.select().from(kycTable)
      .where(and(eq(kycTable.userId, userId), eq(kycTable.tier, tier)))
      .orderBy(desc(kycTable.submittedAt))
      .limit(1);

    if (existingPending && existingPending.status === "pending") {
      res.status(400).json({ error: "A verification request for this tier is already under review" });
      return;
    }

    const [kyc] = await db.insert(kycTable).values({
      userId,
      tier,
      status: "pending",
      fullName,
      dateOfBirth,
      address,
      idType,
      idNumber,
      idFrontImage,
      idBackImage,
      selfieImage,
    }).returning();

    const msgId = await sendKycAlert({
      kycId: kyc.id,
      userId,
      username: user.username,
      email: user.email,
      tier,
      fullName,
      idType,
      idNumber,
      country: user.country,
      frontImage: idFrontImage,
      backImage: idBackImage,
      selfieImage,
    });

    if (msgId) {
      await db.update(kycTable).set({ telegramMessageId: msgId }).where(eq(kycTable.id, kyc.id));
    }

    res.status(201).json({
      success: true,
      tier,
      status: "pending",
      message: tier === 2
        ? "Your Tier 2 verification has been submitted and is under review."
        : "Your Tier 3 address verification has been submitted and is under review.",
    });
  } catch (e) {
    req.log.error({ e }, "Error submitting KYC");
    res.status(500).json({ error: "Failed to submit verification" });
  }
});

export default router;
