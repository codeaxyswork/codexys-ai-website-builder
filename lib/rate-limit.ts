interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

interface RateLimitTracker {
  count: number;
  resetTime: number;
}

/**
 * Lightweight, thread-safe in-memory rate limiter for local development and standard server runtimes.
 * NOTE FOR DISTRIBUTED PRODUCTION DEPLOYMENT:
 * Multi-region serverless deployments (e.g. Vercel multi-region) may later swap this in-memory Map
 * for an external Redis/Upstash store without changing the public function signature or breaking existing API callers.
 */
const memoryStore = new Map<string, RateLimitTracker>();

// Cleanup stale entries every 5 minutes to prevent memory leak
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of memoryStore.entries()) {
      if (now > data.resetTime) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { limit: 10, windowMs: 60 * 1000 }
): { success: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const data = memoryStore.get(identifier);

  if (!data || now > data.resetTime) {
    memoryStore.set(identifier, {
      count: 1,
      resetTime: now + options.windowMs,
    });
    return {
      success: true,
      remaining: options.limit - 1,
      resetMs: options.windowMs,
    };
  }

  if (data.count >= options.limit) {
    return {
      success: false,
      remaining: 0,
      resetMs: Math.max(0, data.resetTime - now),
    };
  }

  data.count += 1;
  return {
    success: true,
    remaining: options.limit - data.count,
    resetMs: Math.max(0, data.resetTime - now),
  };
}
