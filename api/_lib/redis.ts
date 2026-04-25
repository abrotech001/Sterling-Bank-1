import { Redis } from "@upstash/redis";

// Initialize Redis client from Upstash
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

export async function publishUserEvent(userId: number, event: string, data: any) {
  try {
    await redis.publish(`user:${userId}`, JSON.stringify({ event, data }));
  } catch (error) {
    console.error("[Redis] Failed to publish event:", error);
  }
}

export async function publishGlobalEvent(event: string, data: any) {
  try {
    await redis.publish("global", JSON.stringify({ event, data }));
  } catch (error) {
    console.error("[Redis] Failed to publish global event:", error);
  }
}

export async function cacheSet(key: string, value: any, exSeconds: number = 3600) {
  try {
    await redis.setex(key, exSeconds, JSON.stringify(value));
  } catch (error) {
    console.error("[Redis] Failed to set cache:", error);
  }
}

export async function cacheGet(key: string) {
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value as string) : null;
  } catch (error) {
    console.error("[Redis] Failed to get cache:", error);
    return null;
  }
}

export async function cacheDel(key: string) {
  try {
    await redis.del(key);
  } catch (error) {
    console.error("[Redis] Failed to delete cache:", error);
  }
}

export { redis };
