import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error(
        'Upstash Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
      );
    }

    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  return redis;
}

/**
 * Publish a transaction update to a user channel
 */
export async function broadcastTransactionUpdate(
  userId: number,
  transaction: any
): Promise<void> {
  try {
    const redisClient = getRedis();
    const channel = `user:${userId}:transactions`;

    await redisClient.publish(channel, JSON.stringify({
      type: 'transaction_update',
      data: transaction,
      timestamp: new Date().toISOString(),
    }));
  } catch (e) {
    console.error('[v0] Failed to broadcast transaction update:', e);
  }
}

/**
 * Publish a wallet balance update
 */
export async function broadcastWalletUpdate(
  userId: number,
  balance: number,
  pendingBalance: number
): Promise<void> {
  try {
    const redisClient = getRedis();
    const channel = `user:${userId}:wallet`;

    await redisClient.publish(channel, JSON.stringify({
      type: 'wallet_update',
      data: { balance, pendingBalance },
      timestamp: new Date().toISOString(),
    }));
  } catch (e) {
    console.error('[v0] Failed to broadcast wallet update:', e);
  }
}

/**
 * Publish a notification to a user
 */
export async function sendNotificationToUser(
  userId: number,
  notification: {
    type: string;
    title: string;
    message: string;
    data?: any;
  }
): Promise<void> {
  try {
    const redisClient = getRedis();
    const channel = `user:${userId}:notifications`;

    await redisClient.publish(channel, JSON.stringify({
      ...notification,
      timestamp: new Date().toISOString(),
    }));
  } catch (e) {
    console.error('[v0] Failed to send notification:', e);
  }
}

/**
 * Store a temporary session or state
 */
export async function setSession(
  key: string,
  value: any,
  expirationSeconds: number = 3600
): Promise<void> {
  try {
    const redisClient = getRedis();
    await redisClient.setex(key, expirationSeconds, JSON.stringify(value));
  } catch (e) {
    console.error('[v0] Failed to set session:', e);
  }
}

/**
 * Get a temporary session or state
 */
export async function getSession(key: string): Promise<any> {
  try {
    const redisClient = getRedis();
    const value = await redisClient.get(key);
    return value ? JSON.parse(value as string) : null;
  } catch (e) {
    console.error('[v0] Failed to get session:', e);
    return null;
  }
}

/**
 * Delete a temporary session or state
 */
export async function deleteSession(key: string): Promise<void> {
  try {
    const redisClient = getRedis();
    await redisClient.del(key);
  } catch (e) {
    console.error('[v0] Failed to delete session:', e);
  }
}

/**
 * Store rate limit counter
 */
export async function recordRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const redisClient = getRedis();
    const current = await redisClient.incr(key);

    if (current === 1) {
      await redisClient.expire(key, windowSeconds);
    }

    return current <= limit;
  } catch (e) {
    console.error('[v0] Failed to record rate limit:', e);
    return true; // Allow request if Redis is down
  }
}
