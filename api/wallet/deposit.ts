import { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../_lib/db';
import { walletsTable, transactionsTable, notificationsTable } from '@sterling/db/schema';
import { verifyToken } from '../_lib/auth';
import { created, error } from '../_lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return error(res, 'Method not allowed', 405);
  }

  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return error(res, 'Valid amount is required');
  }

  if (amount > 50000) {
    return error(res, 'Maximum deposit amount is $50,000');
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

    // Update wallet balance
    await db
      .update(walletsTable)
      .set({
        balance: sql`${walletsTable.balance} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(walletsTable.userId, userId));

    // Create transaction record
    const transactions = await db
      .insert(transactionsTable)
      .values({
        type: 'deposit',
        amount: amount.toString(),
        status: 'completed',
        receiverId: userId,
        note: 'Account deposit',
      })
      .returning();

    const transaction = transactions[0];

    // Create notification
    await db.insert(notificationsTable).values({
      userId,
      type: 'transaction',
      title: 'Deposit Successful',
      message: `$${parseFloat(amount).toFixed(2)} has been added to your account.`,
    });

    // Get updated wallet
    const wallets = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, userId));

    const updatedWallet = wallets[0];

    return created(res, {
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: parseFloat(transaction.amount),
        status: transaction.status,
        note: transaction.note,
        receiverId: transaction.receiverId,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      },
      wallet: {
        balance: parseFloat(updatedWallet.balance),
        pendingBalance: parseFloat(updatedWallet.pendingBalance),
        currency: updatedWallet.currency,
      },
      message: 'Deposit processed successfully',
    });
  } catch (e) {
    console.error('[v0] Deposit error:', e);
    return error(res, 'Failed to process deposit', 500);
  }
}
