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
  profileImage: user.profileImage,
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

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

router.post("/me/avatar", requireAuth, async (req, res) => {
  const { image } = req.body as { image?: string };
  if (!image || typeof image !== "string") {
    res.status(400).json({ error: "Image data is required" });
    return;
  }

  const match = image.match(/^data:image\/(jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    res.status(400).json({ error: "Only JPG and PNG images are allowed" });
    return;
  }

  const base64 = match[2];
  const sizeBytes = Math.floor((base64.length * 3) / 4);
  if (sizeBytes > MAX_AVATAR_BYTES) {
    res.status(400).json({ error: `Image is too large. Maximum size is 5MB.` });
    return;
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set({ profileImage: image, updatedAt: new Date() })
      .where(eq(usersTable.id, req.userId!))
      .returning();
    res.json({ user: formatUser(updated) });
  } catch (e) {
    req.log.error({ e }, "Error updating profile image");
    res.status(500).json({ error: "Failed to update profile image" });
  }
});

router.delete("/me/avatar", requireAuth, async (req, res) => {
  try {
    const [updated] = await db
      .update(usersTable)
      .set({ profileImage: null, updatedAt: new Date() })
      .where(eq(usersTable.id, req.userId!))
      .returning();
    res.json({ user: formatUser(updated) });
  } catch (e) {
    req.log.error({ e }, "Error removing profile image");
    res.status(500).json({ error: "Failed to remove profile image" });
  }
});

router.post("/set-pin", requireAuth, async (req, res) => {
  const { pin, confirmPin, currentPin } = req.body;
  const user = req.user!;

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
    if (user.pinHash) {
      if (!currentPin) {
        res.status(400).json({ error: "Current passcode is required to change your passcode" });
        return;
      }
      const valid = await comparePin(currentPin, user.pinHash);
      if (!valid) {
        res.status(401).json({ error: "Current passcode is incorrect" });
        return;
      }
    }

    const pinHash = await hashPin(pin);
    await db.update(usersTable).set({ pinHash }).where(eq(usersTable.id, req.userId!));
    res.json({ success: true, message: user.pinHash ? "Transaction PIN updated" : "Transaction PIN set successfully" });
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
