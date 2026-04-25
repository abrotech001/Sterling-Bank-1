import { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, or, desc, sql } from 'drizzle-orm';
import { aliasedTable } from 'drizzle-orm';
import { getDb } from '../_lib/db';
import { transactionsTable, usersTable } from '@sterling/db/schema';
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
    const { limit = '100', offset = '0' } = req.query as Record<string, string>;

    const db = getDb();

    // Create aliases for sender and receiver
    const senderAlias = aliasedTable(usersTable, 'sender');
    const receiverAlias = aliasedTable(usersTable, 'receiver');

    // Get transactions with user details
    const rows = await db
      .select({
        tx: transactionsTable,
        senderUsername: senderAlias.username,
        senderFirstName: senderAlias.firstName,
        senderLastName: senderAlias.lastName,
        senderAccount: senderAlias.accountNumber,
        receiverUsername: receiverAlias.username,
        receiverFirstName: receiverAlias.firstName,
        receiverLastName: receiverAlias.lastName,
        receiverAccount: receiverAlias.accountNumber,
      })
      .from(transactionsTable)
      .leftJoin(senderAlias, eq(transactionsTable.senderId, senderAlias.id))
      .leftJoin(receiverAlias, eq(transactionsTable.receiverId, receiverAlias.id))
      .where(
        or(
          eq(transactionsTable.senderId, userId),
          eq(transactionsTable.receiverId, userId)
        )
      )
      .orderBy(desc(transactionsTable.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactionsTable)
      .where(
        or(
          eq(transactionsTable.senderId, userId),
          eq(transactionsTable.receiverId, userId)
        )
      );

    const total = parseInt(countResult[0]?.count.toString() || '0');

    // Transform response
    const transactions = rows.map((r) => {
      const tx = r.tx;
      const isOutgoing =
        tx.senderId === userId &&
        !['deposit', 'admin_fund', 'gift_card'].includes(tx.type);

      const direction: 'incoming' | 'outgoing' = isOutgoing ? 'outgoing' : 'incoming';
      const label = direction === 'outgoing' ? 'Sent' : 'Received';

      let counterpartyName: string | null = null;
      let counterpartyAccount: string | null = null;

      if (tx.type === 'transfer') {
        if (direction === 'outgoing') {
          counterpartyName =
            [r.receiverFirstName, r.receiverLastName].filter(Boolean).join(' ') ||
            (r.receiverUsername ? `@${r.receiverUsername}` : null);
          counterpartyAccount = r.receiverAccount;
        } else {
          counterpartyName =
            [r.senderFirstName, r.senderLastName].filter(Boolean).join(' ') ||
            (r.senderUsername ? `@${r.senderUsername}` : null);
          counterpartyAccount = r.senderAccount;
        }
      } else if (tx.type === 'admin_fund') {
        counterpartyName = 'Crestfield Bank';
      } else if (tx.type === 'gift_card') {
        counterpartyName = tx.method ? `${tx.method} Gift Card` : 'Gift Card';
      } else if (tx.type === 'deposit') {
        counterpartyName = tx.method ? `${tx.method.toUpperCase()} Deposit` : 'Deposit';
      } else if (tx.type === 'withdrawal') {
        counterpartyName = tx.bankName || tx.destination || 'External Account';
      }

      return {
        id: tx.id,
        type: tx.type,
        amount: parseFloat(tx.amount),
        status: tx.status,
        note: tx.note,
        description: tx.note,
        declineReason: tx.declineReason,
        senderId: tx.senderId,
        receiverId: tx.receiverId,
        method: tx.method,
        destination: tx.destination,
        direction,
        label,
        counterpartyName,
        counterpartyAccount,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      };
    });

    return success(res, { transactions, total });
  } catch (e) {
    console.error('[v0] Get transactions error:', e);
    return error(res, 'Failed to get transactions', 500);
  }
}
