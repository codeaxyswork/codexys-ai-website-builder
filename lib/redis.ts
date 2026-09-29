import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;
let isInitialized = false;

export function getRedisClient(): Redis | null {
  if (isInitialized) {
    return redisClient;
  }

  isInitialized = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (
    !url ||
    !token ||
    url.includes("[SENSITIVE]") ||
    token.includes("[SENSITIVE]") ||
    token.includes("<MY_UPSTASH") ||
    token.includes("YOUR_REST_TOKEN") ||
    token.startsWith("<")
  ) {
    console.log("[Redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not configured. Caching is in BYPASS mode.");
    redisClient = null;
    return null;
  }

  try {
    redisClient = new Redis({
      url,
      token,
    });
    console.log("[Redis] Upstash Redis client initialized successfully.");
    return redisClient;
  } catch (err) {
    console.error("[Redis] Initialization error:", err);
    redisClient = null;
    return null;
  }
}

export async function redisGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const data = await client.get<T>(key);
    return data;
  } catch (err) {
    console.warn(`[Redis] GET Error for key "${key}":`, err);
    return null;
  }
}

export async function redisSet<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    if (ttlSeconds && ttlSeconds > 0) {
      await client.set(key, value, { ex: ttlSeconds });
    } else {
      await client.set(key, value);
    }
    return true;
  } catch (err) {
    console.warn(`[Redis] SET Error for key "${key}":`, err);
    return false;
  }
}

export async function redisDel(key: string | string[]): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    if (Array.isArray(key)) {
      if (key.length > 0) {
        await client.del(...key);
      }
    } else {
      await client.del(key);
    }
    return true;
  } catch (err) {
    console.warn(`[Redis] DEL Error for key "${key}":`, err);
    return false;
  }
}
