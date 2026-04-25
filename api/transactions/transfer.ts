import { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../_lib/db';
import { usersTable, walletsTable, transactionsTable } from '@sterling/db/schema';
import { verifyToken, comparePin } from '../_lib/auth';
import { created, error } from '../_lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return error(res, 'Method not allowed', 405);
  }

  const {
    recipientAccountNumber,
    toAccountNumber,
    amount: rawAmount,
    pin,
    note,
    description,
  } = req.body;

  const recipientAccount = recipientAccountNumber || toAccountNumber;
  const transactionNote = (note || description || '').toString().trim();

  if (!recipientAccount || !rawAmount) {
    return error(res, 'Recipient and amount are required');
  }

  const amountNum = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount));
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return error(res, 'Amount must be a positive number');
  }

  if (amountNum > 1000000) {
    return error(res, 'Amount exceeds the per-transfer limit');
  }

  if (!transactionNote) {
    return error(res, 'A description is required for every transfer');
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
    const amount = amountNum.toFixed(2);

    const db = getDb();

    // Get sender user
    const senders = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const sender = senders[0];
    if (!sender) {
      return error(res, 'User not found', 404);
    }

    // Check PIN if set
    if (sender.pinHash) {
      if (!pin) {
        return error(res, 'Transaction PIN is required');
      }

      const validPin = await comparePin(pin, sender.pinHash);
      if (!validPin) {
        return error(res, 'Invalid transaction PIN', 401);
      }
    }

    // Get recipient
    const recipients = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.accountNumber, recipientAccount));

    const recipient = recipients[0];
    if (!recipient) {
      return error(res, 'Recipient account not found', 404);
    }

    if (recipient.id === userId) {
      return error(res, 'Cannot transfer to your own account');
    }

    if (recipient.status !== 'active') {
      return error(res, 'Recipient account is not active');
    }

    // Check sender balance
    const wallets = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, userId));

    const wallet = wallets[0];
    if (!wallet || parseFloat(wallet.balance) < parseFloat(amount)) {
      return error(res, 'Insufficient funds');
    }

    // Update pending balance
    await db
      .update(walletsTable)
      .set({
        pendingBalance: sql`${walletsTable.pendingBalance} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(walletsTable.userId, userId));

    // Create transaction
    const transactions = await db
      .insert(transactionsTable)
      .values({
        type: 'transfer',
        amount: parseFloat(amount).toString(),
        status: 'pending',
        senderId: userId,
        receiverId: recipient.id,
        note: transactionNote || null,
      })
      .returning();

    const transaction = transactions[0];

    // TODO: Send Telegram notification
    // TODO: Broadcast via Redis pub/sub if needed

    return created(res, {
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: parseFloat(transaction.amount),
        status: transaction.status,
        note: transaction.note,
        senderId: transaction.senderId,
        receiverId: transaction.receiverId,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      },
      message: 'Transfer request submitted and pending authorization',
    });
  } catch (e) {
    console.error('[v0] Transfer error:', e);
    return error(res, 'Failed to process transfer', 500);
  }
}
