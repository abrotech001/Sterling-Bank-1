import { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, and, or } from 'drizzle-orm';
import { getDb } from '../_lib/db';
import { transactionsTable } from '@sterling/db/schema';
import { verifyToken } from '../_lib/auth';
import { success, error } from '../_lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return error(res, 'Method not allowed', 405);
  }

  const txId = parseInt(req.query.id as string);

  if (!txId || isNaN(txId)) {
    return error(res, 'Transaction ID is required');
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

    const transactions = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.id, txId),
          or(
            eq(transactionsTable.senderId, userId),
            eq(transactionsTable.receiverId, userId)
          )
        )
      );

    const transaction = transactions[0];

    if (!transaction) {
      return error(res, 'Transaction not found', 404);
    }

    return success(res, {
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: parseFloat(transaction.amount),
        status: transaction.status,
        note: transaction.note,
        declineReason: transaction.declineReason,
        senderId: transaction.senderId,
        receiverId: transaction.receiverId,
        method: transaction.method,
        destination: transaction.destination,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      },
      bank: 'Crestfield Bank',
      generatedAt: new Date(),
    });
  } catch (e) {
    console.error('[v0] Get receipt error:', e);
    return error(res, 'Failed to get receipt', 500);
  }
}
