import { redisGet, redisSet, redisDel, getRedisClient } from "./redis";

export const CACHE_KEYS = {
  userUsage: (userId: string) => `user:usage:${userId}`,
  commandCenter: (websiteId: string) => `seo:command-center:${websiteId}`,
  gscPerformance: (websiteId: string) => `seo:gsc-performance:${websiteId}`,
  seoSettings: (websiteId: string) => `seo:${websiteId}`,
};

export const CACHE_TTLS = {
  USER_USAGE: 300,        // 5 minutes
  COMMAND_CENTER: 900,    // 15 minutes
  GSC_PERFORMANCE: 3600,  // 1 hour
  SEO_SETTINGS: 300,      // 5 minutes
};

export type CacheStatus = "HIT" | "MISS" | "BYPASS";

export async function getCache<T>(key: string): Promise<{ data: T | null; status: CacheStatus }> {
  if (!getRedisClient()) {
    return { data: null, status: "BYPASS" };
  }

  const data = await redisGet<T>(key);
  if (data !== null) {
    return { data, status: "HIT" };
  }
  return { data: null, status: "MISS" };
}

export async function setCache<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
  if (!getRedisClient()) {
    return false;
  }
  return await redisSet<T>(key, value, ttlSeconds);
}

export async function deleteCache(key: string | string[]): Promise<boolean> {
  if (!getRedisClient()) {
    return false;
  }
  return await redisDel(key);
}

export async function invalidateWebsiteCache(websiteId: string): Promise<void> {
  if (!websiteId) return;
  const keys = [
    CACHE_KEYS.commandCenter(websiteId),
    CACHE_KEYS.gscPerformance(websiteId),
    CACHE_KEYS.seoSettings(websiteId),
  ];
  await deleteCache(keys);
}

export async function invalidateUserCache(userId: string): Promise<void> {
  if (!userId) return;
  await deleteCache(CACHE_KEYS.userUsage(userId));
}

export function getCacheHeader(status: CacheStatus): Record<string, string> {
  return { "X-Cache": status };
}
