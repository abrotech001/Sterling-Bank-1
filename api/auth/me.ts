import { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { getDb } from '../_lib/db';
import { usersTable, walletsTable } from '@sterling/db/schema';
import { verifyToken } from '../_lib/auth';
import { success, error } from '../_lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return error(res, 'Method not allowed', 405);
  }

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return error(res, 'Unauthorized', 401);
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return error(res, 'Invalid token', 401);
    }

    const db = getDb();
    const userId = typeof decoded === 'object' && decoded.userId ? decoded.userId : decoded;

    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const user = users[0];

    if (!user) {
      return error(res, 'User not found', 404);
    }

    // Get wallet
    const wallets = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, userId));

    const wallet = wallets[0];

    return success(res, {
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
    console.error('[v0] Get me error:', e);
    return error(res, 'Failed to get user', 500);
  }
}
