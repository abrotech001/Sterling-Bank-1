import { Router } from "express";
import { db } from "@workspace/db";
import { kycTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { sendKycAlert } from "../lib/telegram";

const router = Router();

router.get("/status", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const user = req.user!;

  try {
    const [kyc] = await db.select().from(kycTable)
      .where(eq(kycTable.userId, userId))
      .orderBy(desc(kycTable.submittedAt))
      .limit(1);

    if (!kyc) {
      res.json({
        level: user.kycLevel,
        status: "not_started",
      });
      return;
    }

    res.json({
      level: user.kycLevel,
      status: kyc.status,
      rejectionReason: kyc.rejectionReason || undefined,
      submittedAt: kyc.submittedAt,
      reviewedAt: kyc.reviewedAt || undefined,
    });
  } catch (e) {
    req.log.error({ e }, "Error getting KYC status");
    res.status(500).json({ error: "Failed to get KYC status" });
  }
});

router.post("/submit", requireAuth, async (req, res) => {
  const { fullName, dateOfBirth, address, idType, idNumber, idFrontImage, idBackImage, selfieImage } = req.body;
  const userId = req.userId!;
  const user = req.user!;

  if (!fullName || !dateOfBirth || !address || !idType || !idNumber || !idFrontImage) {
    res.status(400).json({ error: "All required fields must be provided" });
    return;
  }

  if (user.kycLevel >= 1) {
    res.status(400).json({ error: "Your identity has already been verified" });
    return;
  }

  try {
    const [existingPending] = await db.select().from(kycTable)
      .where(eq(kycTable.userId, userId))
      .orderBy(desc(kycTable.submittedAt))
      .limit(1);

    if (existingPending && existingPending.status === "pending") {
      res.status(400).json({ error: "A verification request is already under review" });
      return;
    }

    const [kyc] = await db.insert(kycTable).values({
      userId,
      status: "pending",
      fullName,
      dateOfBirth,
      address,
      idType,
      idNumber,
      idFrontImage,
      idBackImage: idBackImage || null,
      selfieImage: selfieImage || null,
    }).returning();

    const msgId = await sendKycAlert(kyc.id, userId, fullName, idType, user.country);

    if (msgId) {
      await db.update(kycTable).set({ telegramMessageId: msgId }).where(eq(kycTable.id, kyc.id));
    }

    res.status(201).json({ success: true, message: "Verification documents submitted successfully. Our team will review them shortly." });
  } catch (e) {
    req.log.error({ e }, "Error submitting KYC");
    res.status(500).json({ error: "Failed to submit verification" });
  }
});

export default router;
