import { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { getDb } from '../_lib/db';
import { usersTable, walletsTable } from '@sterling/db/schema';
import { generateToken } from '../_lib/auth';
import { sendTransactionNotification } from '../_lib/email';
import { success, error } from '../_lib/response';
import { validateRequiredFields } from '../_lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return error(res, 'Method not allowed', 405);
  }

  const { email, otp, userId } = req.body;

  if ((!email && !userId) || !otp) {
    return error(res, 'Email or userId and OTP are required');
  }

  try {
    const db = getDb();
    let user;

    // Find user by email or ID
    if (userId) {
      const users = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, parseInt(userId)));
      user = users[0];
    } else {
      const users = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email.toLowerCase().trim()));
      user = users[0];
    }

    if (!user) {
      return error(res, 'User not found', 404);
    }

    // Validate OTP
    if (!user.otpCode || user.otpCode !== otp) {
      return error(res, 'Invalid OTP code');
    }

    // Check OTP expiration
    if (!user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      return error(res, 'OTP has expired. Please request a new one.');
    }

    // Update user status
    const updatedUsers = await db
      .update(usersTable)
      .set({
        status: 'active',
        isEmailVerified: true,
        otpCode: null,
        otpExpiresAt: null,
      })
      .where(eq(usersTable.id, user.id))
      .returning();

    const updatedUser = updatedUsers[0];

    // Get wallet info
    const wallets = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, user.id));

    const token = generateToken(user.id);

    // Send welcome email
    sendTransactionNotification(updatedUser.email, {
      type: 'account_verification',
      status: 'completed',
      createdAt: new Date(),
    }).catch((e) => {
      console.error('[v0] Failed to send welcome email:', e);
    });

    return success(res, {
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
      wallet: wallets[0] ? {
        id: wallets[0].id,
        balance: parseFloat(wallets[0].balance),
        pendingBalance: parseFloat(wallets[0].pendingBalance),
        currency: wallets[0].currency,
      } : null,
    });
  } catch (e) {
    console.error('[v0] OTP verification error:', e);
    return error(res, 'Verification failed', 500);
  }
}
