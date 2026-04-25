import { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { getDb } from '../_lib/db';
import { usersTable } from '@sterling/db/schema';
import { verifyToken } from '../_lib/auth';
import { success, error } from '../_lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return error(res, 'Method not allowed', 405);
  }

  const accountNumber = String(req.query.accountNumber || '').trim();

  if (!accountNumber) {
    return error(res, 'Account number is required');
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

    const recipients = await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        username: usersTable.username,
        accountNumber: usersTable.accountNumber,
        status: usersTable.status,
      })
      .from(usersTable)
      .where(eq(usersTable.accountNumber, accountNumber));

    const recipient = recipients[0];

    if (!recipient) {
      return error(res, 'No Crestfield account matches that number', 404);
    }

    if (recipient.id === userId) {
      return error(res, 'You cannot transfer to your own account');
    }

    if (recipient.status === 'frozen') {
      return error(res, 'This account cannot receive transfers right now');
    }

    const fullName =
      [recipient.firstName, recipient.lastName].filter(Boolean).join(' ') ||
      recipient.username;

    return success(res, {
      recipient: {
        accountNumber: recipient.accountNumber,
        fullName,
        username: recipient.username,
      },
    });
  } catch (e) {
    console.error('[v0] Lookup recipient error:', e);
    return error(res, 'Failed to look up account', 500);
  }
}
