import { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { getDb } from '../_lib/db';
import { walletsTable } from '@sterling/db/schema';
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

    const userId = typeof decoded === 'object' && decoded.userId ? decoded.userId : decoded;
    const db = getDb();

    const wallets = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, userId));

    const wallet = wallets[0];

    if (!wallet) {
      return error(res, 'Wallet not found', 404);
    }

    return success(res, {
      id: wallet.id,
      userId: wallet.userId,
      balance: parseFloat(wallet.balance),
      pendingBalance: parseFloat(wallet.pendingBalance),
      currency: wallet.currency,
      updatedAt: wallet.updatedAt,
    });
  } catch (e) {
    console.error('[v0] Get wallet error:', e);
    return error(res, 'Failed to get wallet', 500);
  }
}
