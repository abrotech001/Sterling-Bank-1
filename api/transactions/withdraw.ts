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

  const { amount, method, destination, bankName, accountDetails, pin, note } = req.body;

  if (!amount || !method || !destination || !pin) {
    return error(res, 'Amount, method, destination, and PIN are required');
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

    // Get user
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const user = users[0];
    if (!user) {
      return error(res, 'User not found', 404);
    }

    // Check KYC level
    if (user.kycLevel < 1) {
      return error(res, 'Identity verification required', 403);
    }

    // Check PIN is set
    if (!user.pinHash) {
      return error(res, 'Please set a transaction PIN first');
    }

    // Verify PIN
    const validPin = await comparePin(pin, user.pinHash);
    if (!validPin) {
      return error(res, 'Invalid transaction PIN', 401);
    }

    // Check balance
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
        type: 'withdrawal',
        amount: parseFloat(amount).toString(),
        status: 'pending',
        senderId: userId,
        method,
        destination,
        bankName: bankName || null,
        accountDetails: accountDetails || null,
        note: note || null,
      })
      .returning();

    const transaction = transactions[0];

    // TODO: Send Telegram notification

    return created(res, {
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: parseFloat(transaction.amount),
        status: transaction.status,
        method: transaction.method,
        destination: transaction.destination,
        senderId: transaction.senderId,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      },
      message: 'Withdrawal request submitted and pending processing',
    });
  } catch (e) {
    console.error('[v0] Withdrawal error:', e);
    return error(res, 'Failed to process withdrawal', 500);
  }
}
