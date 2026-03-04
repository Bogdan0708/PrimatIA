/**
 * Redis-backed rate limiter for distributed deployments.
 * Used as a second layer in auth API routes (middleware still has in-memory rate limiting).
 * Fails open if Redis is unavailable — the in-memory middleware layer still protects.
 */

import IORedis from "ioredis";

let redis: IORedis | null = null;

function getRedis(): IORedis | null {
  if (!process.env.REDIS_URL) return null;
  if (!redis) {
    redis = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    });
    redis.connect().catch(() => {
      // Fail silently — rate limiting is best-effort
      redis = null;
    });
  }
  return redis;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Check rate limit using Redis INCR + EXPIRE (atomic sliding window).
 * @param key - Rate limit key (e.g. "rl:login:192.168.1.1")
 * @param maxRequests - Maximum requests allowed in window
 * @param windowSec - Window duration in seconds
 */
export async function checkDistributedRateLimit(
  key: string,
  maxRequests: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const client = getRedis();
  if (!client) {
    // No Redis — fail open, let in-memory middleware handle it
    return { allowed: true, remaining: maxRequests };
  }

  try {
    const current = await client.incr(key);
    if (current === 1) {
      await client.expire(key, windowSec);
    }
    return {
      allowed: current <= maxRequests,
      remaining: Math.max(0, maxRequests - current),
    };
  } catch {
    // Redis error — fail open
    return { allowed: true, remaining: maxRequests };
  }
}
