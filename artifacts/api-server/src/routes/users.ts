import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, walletsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { hashPin, comparePin } from "../lib/auth";

const router = Router();

const formatUser = (user: typeof usersTable.$inferSelect) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
  country: user.country,
  status: user.status,
  kycLevel: user.kycLevel,
  hasPin: !!user.pinHash,
  accountNumber: user.accountNumber,
  createdAt: user.createdAt,
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));

    res.json({
      user: {
        ...formatUser(user),
        wallet: wallet ? {
          id: wallet.id,
          userId: wallet.userId,
          balance: wallet.balance,
          pendingBalance: wallet.pendingBalance,
          currency: wallet.currency,
          updatedAt: wallet.updatedAt,
        } : null,
      },
    });
  } catch (e) {
    req.log.error({ e }, "Error getting current user");
    res.status(500).json({ error: "Failed to get user" });
  }
});

router.patch("/me", requireAuth, async (req, res) => {
  const { firstName, lastName, phone } = req.body;
  try {
    const updateData: Partial<typeof usersTable.$inferInsert> = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;

    const [updated] = await db
      .update(usersTable)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(usersTable.id, req.userId!))
      .returning();

    res.json({ user: formatUser(updated) });
  } catch (e) {
    req.log.error({ e }, "Error updating user");
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.get("/profile", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));

    res.json({
      ...formatUser(user),
      wallet: wallet ? {
        id: wallet.id,
        userId: wallet.userId,
        balance: parseFloat(wallet.balance),
        pendingBalance: parseFloat(wallet.pendingBalance),
        currency: wallet.currency,
        updatedAt: wallet.updatedAt,
      } : null,
    });
  } catch (e) {
    req.log.error({ e }, "Error getting profile");
    res.status(500).json({ error: "Failed to get profile" });
  }
});

router.post("/set-pin", requireAuth, async (req, res) => {
  const { pin, confirmPin } = req.body;

  if (!pin || !confirmPin) {
    res.status(400).json({ error: "PIN and confirmation are required" });
    return;
  }

  if (pin !== confirmPin) {
    res.status(400).json({ error: "PINs do not match" });
    return;
  }

  if (!/^\d{4,6}$/.test(pin)) {
    res.status(400).json({ error: "PIN must be 4-6 digits" });
    return;
  }

  try {
    const pinHash = await hashPin(pin);
    await db.update(usersTable).set({ pinHash }).where(eq(usersTable.id, req.userId!));
    res.json({ success: true, message: "Transaction PIN set successfully" });
  } catch (e) {
    req.log.error({ e }, "Error setting PIN");
    res.status(500).json({ error: "Failed to set PIN" });
  }
});

router.post("/verify-pin", requireAuth, async (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    res.status(400).json({ error: "PIN is required" });
    return;
  }

  try {
    const user = req.user!;

    if (!user.pinHash) {
      res.status(400).json({ error: "No PIN set. Please set a transaction PIN first." });
      return;
    }

    const valid = await comparePin(pin, user.pinHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid PIN" });
      return;
    }

    res.json({ success: true, message: "PIN verified" });
  } catch (e) {
    req.log.error({ e }, "Error verifying PIN");
    res.status(500).json({ error: "Failed to verify PIN" });
  }
});

export default router;
