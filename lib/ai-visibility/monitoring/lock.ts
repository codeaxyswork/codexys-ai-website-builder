/**
 * Phase 3E: Duplicate Run Protection & Execution Locking
 * Prevents overlapping monitoring runs for the same website.
 * Uses Upstash Redis if available, with a safe, bounded in-memory fallback.
 * Never makes Redis a hard requirement for the application.
 */

import { getRedisClient } from "@/lib/redis";

// In-memory fallback lock map for single-instance / development / offline environments
const inMemoryLocks = new Map<string, number>();

/**
 * Attempts to acquire an execution lock for a website monitoring run.
 * Lock automatically expires after ttlSeconds (default: 300s / 5 minutes).
 * Returns true if lock was successfully acquired, false if another execution is in progress.
 */
export async function acquireMonitoringLock(
  websiteId: string,
  ttlSeconds: number = 300
): Promise<boolean> {
  const lockKey = `ai_visibility_monitoring_lock:${websiteId}`;
  const redis = getRedisClient();

  if (redis) {
    try {
      // SETNX with TTL via Upstash Redis
      const result = await redis.set(lockKey, "LOCKED", {
        nx: true,
        ex: ttlSeconds,
      });
      return result === "OK";
    } catch (err) {
      console.warn(`[MonitoringLock] Redis lock acquisition warning for ${websiteId}:`, err);
      // Fallback to in-memory check
    }
  }

  // In-memory lock fallback logic
  const now = Date.now();
  const existingExpiry = inMemoryLocks.get(websiteId);

  if (existingExpiry && existingExpiry > now) {
    // Lock currently active
    return false;
  }

  // Set new lock with TTL
  inMemoryLocks.set(websiteId, now + ttlSeconds * 1000);
  return true;
}

/**
 * Releases the monitoring execution lock for a website.
 */
export async function releaseMonitoringLock(websiteId: string): Promise<boolean> {
  const lockKey = `ai_visibility_monitoring_lock:${websiteId}`;
  const redis = getRedisClient();

  // Clear in-memory lock
  inMemoryLocks.delete(websiteId);

  if (redis) {
    try {
      await redis.del(lockKey);
      return true;
    } catch (err) {
      console.warn(`[MonitoringLock] Redis lock release warning for ${websiteId}:`, err);
    }
  }

  return true;
}

/**
 * Checks whether a monitoring run lock is currently held for a website.
 */
export async function isMonitoringLocked(websiteId: string): Promise<boolean> {
  const lockKey = `ai_visibility_monitoring_lock:${websiteId}`;
  const redis = getRedisClient();

  if (redis) {
    try {
      const value = await redis.get(lockKey);
      return Boolean(value);
    } catch (err) {
      // Fallback
    }
  }

  const existingExpiry = inMemoryLocks.get(websiteId);
  return Boolean(existingExpiry && existingExpiry > Date.now());
}
