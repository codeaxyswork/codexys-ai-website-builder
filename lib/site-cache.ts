/**
 * In-Memory TTL & Invalidation Cache for Published Migrated Websites.
 * Eliminates 3-10 second Supabase Cloud DB fetch delays on repeat website views.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cacheMap = new Map<string, CacheEntry<any>>();

/**
 * Retrieves a cached item if present and not expired.
 */
export function getCachedSiteData<T>(key: string): T | null {
  const entry = cacheMap.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheMap.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Sets a cached item with a specified TTL in milliseconds (default 5 minutes).
 */
export function setCachedSiteData<T>(key: string, data: T, ttlMs: number = 300000): void {
  // Prevent cache bloat: cap at 100 entries max
  if (cacheMap.size > 100) {
    const oldestKey = cacheMap.keys().next().value;
    if (oldestKey) cacheMap.delete(oldestKey);
  }
  cacheMap.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Invalidates cache entries matching a key or prefix (e.g. website ID or slug).
 */
export function invalidateCachedSiteData(keyOrPrefix: string): void {
  if (!keyOrPrefix) return;
  const clean = keyOrPrefix.toLowerCase().trim();
  for (const key of Array.from(cacheMap.keys())) {
    if (key.toLowerCase().includes(clean)) {
      cacheMap.delete(key);
    }
  }
}
