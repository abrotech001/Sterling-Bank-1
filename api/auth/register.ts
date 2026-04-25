import { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { getDb } from '../_lib/db';
import { usersTable, walletsTable } from '@sterling/db/schema';
import { hashPassword, generateToken, generateOtp } from '../_lib/auth';
import { sendVerificationEmail } from '../_lib/email';
import { error, created } from '../_lib/response';
import { validateEmail, validatePassword, validateRequiredFields, sanitizeEmail } from '../_lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return error(res, 'Method not allowed', 405);
  }

  const { email, username, firstName, lastName, phone, country, password, confirmPassword } = req.body;

  // Validate required fields
  const missingFields = validateRequiredFields(
    { email, username, phone, country, password, confirmPassword },
    ['email', 'username', 'phone', 'country', 'password', 'confirmPassword']
  );

  if (missingFields.length > 0) {
    return error(res, `Missing required fields: ${missingFields.join(', ')}`);
  }

  // Validate email format
  if (!validateEmail(email)) {
    return error(res, 'Invalid email format');
  }

  // Validate passwords match
  if (password !== confirmPassword) {
    return error(res, 'Passwords do not match');
  }

  // Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return error(res, passwordValidation.errors[0]);
  }

  try {
    const db = getDb();
    const normalizedEmail = sanitizeEmail(email);
    const normalizedUsername = username.toLowerCase().trim();

    // Check if email exists
    const existingByEmail = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail));

    if (existingByEmail.length > 0) {
      return error(res, 'An account with this email already exists', 409);
    }

    // Check if username exists
    const existingByUsername = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, normalizedUsername));

    if (existingByUsername.length > 0) {
      return error(res, 'Username already taken', 409);
    }

    // Hash password and generate OTP
    const passwordHash = await hashPassword(password);
    const otp = generateOtp();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Create user
    const newUsers = await db
      .insert(usersTable)
      .values({
        email: normalizedEmail,
        username: normalizedUsername,
        firstName: firstName || '',
        lastName: lastName || '',
        phone: phone.trim(),
        country,
        passwordHash,
        status: 'pending_verification',
        otpCode: otp,
        otpExpiresAt,
      })
      .returning();

    const newUser = newUsers[0];

    // Create wallet
    await db.insert(walletsTable).values({
      userId: newUser.id,
      balance: '0.00',
      pendingBalance: '0.00',
      currency: 'USD',
    });

    // Send verification email
    sendVerificationEmail(normalizedEmail, otp).catch((e) => {
      console.error('[v0] Failed to send verification email:', e);
    });

    return created(res, {
      userId: newUser.id,
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        phone: newUser.phone,
        country: newUser.country,
        status: newUser.status,
        kycLevel: newUser.kycLevel,
        hasPin: false,
        createdAt: newUser.createdAt,
        accountNumber: newUser.accountNumber,
      },
      requiresOtp: true,
      message: "We've sent a 6-digit verification code to your email. It will expire in 15 minutes.",
    });
  } catch (e) {
    console.error('[v0] Registration error:', e);
    return error(res, 'Registration failed', 500);
  }
}
