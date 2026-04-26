// @ts-nocheck
// @ts-nocheck
import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, walletsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  hashPassword, comparePassword, generateToken, generateOtp,
  generateAccountNumber, generateResetToken
} from "../lib/auth";
import { sendNewUserAlert } from "../lib/telegram";
import { sendOtpEmail, sendWelcomeEmail } from "../lib/email";

const router = Router();

router.post("/register", async (req, res) => {
  const { email, username, firstName, lastName, phone, country, password, confirmPassword } = req.body;

  if (!email || !username || !phone || !country || !password || !confirmPassword) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  if (password !== confirmPassword) {
    res.status(400).json({ error: "Passwords do not match" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  try {
    const [existingEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
    if (existingEmail) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const [existingUsername] = await db.select().from(usersTable).where(eq(usersTable.username, username.toLowerCase()));
    if (existingUsername) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const accountNumber = generateAccountNumber();
    const otp = generateOtp();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      firstName: firstName || "",
      lastName: lastName || "",
      phone,
      country,
      passwordHash,
      accountNumber,
      status: "pending_verification",
      otpCode: otp,
      otpExpiresAt,
    }).returning();

    await db.insert(walletsTable).values({
      userId: user.id,
      balance: "0.00",
      pendingBalance: "0.00",
      currency: "USD",
    });

    req.log.info({ userId: user.id, otp }, "OTP generated for new user");

    sendOtpEmail(user.email, otp, user.firstName).catch((e) =>
      req.log.error({ e }, "Failed to send OTP email")
    );

    const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || null;
    sendNewUserAlert({
      userId: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      country: user.country,
      accountNumber: user.accountNumber,
      ipAddress,
    }).catch((e) => req.log.error({ e }, "Failed to send new user alert"));

    res.status(201).json({
      userId: user.id,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        phone: user.phone,
        country: user.country,
        status: user.status,
        kycLevel: user.kycLevel,
        hasPin: false,
        createdAt: user.createdAt,
        accountNumber: user.accountNumber,
      },
      requiresOtp: true,
      message: "We've sent a 6-digit verification code to your email. It will expire in 15 minutes.",
    });
  } catch (e) {
    req.log.error({ e }, "Error registering user");
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/verify-otp", async (req, res) => {
  const { email, otp, userId } = req.body;

  if ((!email && !userId) || !otp) {
    res.status(400).json({ error: "Email or userId and OTP are required" });
    return;
  }

  try {
    const [user] = userId
      ? await db.select().from(usersTable).where(eq(usersTable.id, parseInt(userId)))
      : await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));

    if (!user) {
      res.status(400).json({ error: "User not found" });
      return;
    }

    if (!user.otpCode || user.otpCode !== otp) {
      res.status(400).json({ error: "Invalid OTP code" });
      return;
    }

    if (!user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      res.status(400).json({ error: "OTP has expired. Please request a new one." });
      return;
    }

    const [updatedUser] = await db.update(usersTable)
      .set({ status: "active", isEmailVerified: true, otpCode: null, otpExpiresAt: null })
      .where(eq(usersTable.id, user.id))
      .returning();

    const token = generateToken(user.id);

    sendWelcomeEmail(updatedUser.email, updatedUser.firstName || updatedUser.username, updatedUser.accountNumber).catch((e) =>
      req.log.error({ e }, "Failed to send welcome email")
    );

    res.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        phone: updatedUser.phone,
        country: updatedUser.country,
        status: updatedUser.status,
        kycLevel: updatedUser.kycLevel,
        hasPin: !!updatedUser.pinHash,
        createdAt: updatedUser.createdAt,
        accountNumber: updatedUser.accountNumber,
      },
      token,
    });
  } catch (e) {
    req.log.error({ e }, "Error verifying OTP");
    res.status(500).json({ error: "Verification failed" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const validPassword = await comparePassword(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (user.status === "frozen") {
      res.status(403).json({ error: "Your account has been suspended. Please contact support." });
      return;
    }

    if (user.status === "pending_verification") {
      const otp = generateOtp();
      const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await db.update(usersTable).set({ otpCode: otp, otpExpiresAt }).where(eq(usersTable.id, user.id));

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          phone: user.phone,
          country: user.country,
          status: user.status,
          kycLevel: user.kycLevel,
          hasPin: !!user.pinHash,
          createdAt: user.createdAt,
          accountNumber: user.accountNumber,
        },
        requiresOtp: true,
        message: `Your OTP code is: ${otp} (valid for 15 minutes)`,
      });
      return;
    }

    const token = generateToken(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        phone: user.phone,
        country: user.country,
        status: user.status,
        kycLevel: user.kycLevel,
        hasPin: !!user.pinHash,
        createdAt: user.createdAt,
        accountNumber: user.accountNumber,
      },
      token,
    });
  } catch (e) {
    req.log.error({ e }, "Error logging in");
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));

    if (!user) {
      res.json({ success: true, message: "If an account exists with this email, you will receive reset instructions." });
      return;
    }

    const resetToken = generateResetToken();
    const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.update(usersTable)
      .set({ resetToken, resetTokenExpiresAt })
      .where(eq(usersTable.id, user.id));

    req.log.info({ userId: user.id, resetToken }, "Password reset token generated");

    res.json({
      success: true,
      message: `Password reset token: ${resetToken} (This would be sent via email in production)`,
    });
  } catch (e) {
    req.log.error({ e }, "Error in forgot password");
    res.status(500).json({ error: "Failed to process request" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, password, confirmPassword } = req.body;

  if (!token || !password || !confirmPassword) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  if (password !== confirmPassword) {
    res.status(400).json({ error: "Passwords do not match" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.resetToken, token));

    if (!user || !user.resetTokenExpiresAt || new Date() > user.resetTokenExpiresAt) {
      res.status(400).json({ error: "Invalid or expired reset token" });
      return;
    }

    const passwordHash = await hashPassword(password);

    await db.update(usersTable)
      .set({ passwordHash, resetToken: null, resetTokenExpiresAt: null })
      .where(eq(usersTable.id, user.id));

    res.json({ success: true, message: "Password reset successfully" });
  } catch (e) {
    req.log.error({ e }, "Error resetting password");
    res.status(500).json({ error: "Failed to reset password" });
  }
});

router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Both passwords are required" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  try {
    const user = req.user!;
    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    const passwordHash = await hashPassword(newPassword);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
    res.json({ success: true, message: "Password changed successfully" });
  } catch (e) {
    req.log.error({ e }, "Error changing password");
    res.status(500).json({ error: "Failed to change password" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!));
    const user = req.user!;

    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      phone: user.phone,
      country: user.country,
      status: user.status,
      kycLevel: user.kycLevel,
      hasPin: !!user.pinHash,
      createdAt: user.createdAt,
      accountNumber: user.accountNumber,
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
    req.log.error({ e }, "Error getting current user");
    res.status(500).json({ error: "Failed to get user" });
  }
});

export default router;
