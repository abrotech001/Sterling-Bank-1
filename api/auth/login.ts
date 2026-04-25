import { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { getDb } from '../_lib/db';
import { usersTable } from '@sterling/db/schema';
import { comparePassword, generateToken, generateOtp } from '../_lib/auth';
import { success, error } from '../_lib/response';
import { validateEmail } from '../_lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return error(res, 'Method not allowed', 405);
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return error(res, 'Email and password are required');
  }

  if (!validateEmail(email)) {
    return error(res, 'Invalid email format');
  }

  try {
    const db = getDb();
    const normalizedEmail = email.toLowerCase().trim();

    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail));

    const user = users[0];

    if (!user) {
      return error(res, 'Invalid email or password', 401);
    }

    // Verify password
    const validPassword = await comparePassword(password, user.passwordHash);
    if (!validPassword) {
      return error(res, 'Invalid email or password', 401);
    }

    // Check if account is frozen
    if (user.status === 'frozen') {
      return error(res, 'Your account has been suspended. Please contact support.', 403);
    }

    // If account is pending verification, return OTP requirement
    if (user.status === 'pending_verification') {
      const otp = generateOtp();
      const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db
        .update(usersTable)
        .set({ otpCode: otp, otpExpiresAt })
        .where(eq(usersTable.id, user.id));

      return success(res, {
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
    }

    // Login successful
    const token = generateToken(user.id);

    return success(res, {
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
    console.error('[v0] Login error:', e);
    return error(res, 'Login failed', 500);
  }
}
