import { NextRequest, NextResponse } from "next/server";
import { ensureRedisConnection } from "@/lib/redis";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// In development, multiply rate limits by 10x to avoid blocking during testing
const DEV_RATE_LIMIT_MULTIPLIER = process.env.NODE_ENV === "development" ? 10 : 1;

/**
 * Check rate limit using Redis INCR + PEXPIRE (atomic sliding window).
 * In development, limits are 10x higher to avoid blocking during testing.
 */
export async function checkSharedRateLimit(params: {
  request: NextRequest;
  bucket: string;
  limit: number;
  windowMs: number;
  keySuffix?: string;
}): Promise<RateLimitResult> {
  const effectiveLimit = params.limit * DEV_RATE_LIMIT_MULTIPLIER;

  try {
    const redis = await ensureRedisConnection();
    const ip = getClientIp(params.request);
    const key = [
      "rate-limit",
      params.bucket,
      ip,
      params.keySuffix?.trim() || "",
    ]
      .filter(Boolean)
      .join(":");

    // Use multi() for atomic increment and expiry setting if new
    const result = await redis
      .multi()
      .incr(key)
      .pexpire(key, params.windowMs, "NX")
      .pttl(key)
      .exec();

    if (!result) throw new Error("Redis multi execution failed");

    const count = Number(result[0][1] ?? 0);
    const ttlMs = Math.max(0, Number(result[2][1] ?? params.windowMs));
    const remaining = Math.max(0, effectiveLimit - count);

    return {
      allowed: count <= effectiveLimit,
      limit: effectiveLimit,
      remaining,
      retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
    };
  } catch {
    // Fail open if Redis is unavailable
    return {
      allowed: true,
      limit: effectiveLimit,
      remaining: effectiveLimit,
      retryAfterSeconds: 0,
    };
  }
}

/**
 * Alias for backward compatibility with older code expecting checkDistributedRateLimit.
 */
export async function checkDistributedRateLimit(
  key: string,
  maxRequests: number,
  windowSec: number,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const redis = await ensureRedisConnection();
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSec);
    }
    return {
      allowed: current <= maxRequests,
      remaining: Math.max(0, maxRequests - current),
    };
  } catch {
    return { allowed: true, remaining: maxRequests };
  }
}

export function withRateLimitHeaders(
  response: NextResponse,
  rateLimit: Pick<RateLimitResult, "limit" | "remaining" | "retryAfterSeconds">
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
  response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
  response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
  return response;
}

export function createRateLimitExceededResponse(rateLimit: RateLimitResult): NextResponse {
  return withRateLimitHeaders(
    NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    rateLimit
  );
}
