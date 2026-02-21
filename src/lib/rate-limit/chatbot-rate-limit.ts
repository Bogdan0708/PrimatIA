import { randomUUID } from "crypto";
import IORedis from "ioredis";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_KEY_PREFIX = "rate_limit:chatbot";
const RATE_LIMIT_KEY_TTL_SECONDS = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) + 60;

const RATE_LIMIT_LUA = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local windowMs = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  local ttlSeconds = tonumber(ARGV[4])
  local member = ARGV[5]

  redis.call("ZREMRANGEBYSCORE", key, 0, now - windowMs)
  local count = redis.call("ZCARD", key)

  if count >= limit then
    local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
    local retryMs = windowMs
    if oldest[2] then
      retryMs = math.max(0, windowMs - (now - tonumber(oldest[2])))
    end
    redis.call("EXPIRE", key, ttlSeconds)
    return {1, count, retryMs}
  end

  redis.call("ZADD", key, now, member)
  redis.call("EXPIRE", key, ttlSeconds)
  return {0, count + 1, 0}
`;

interface ChatbotRateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
}

interface RateLimitRedisGlobals {
  _chatbotRateLimitRedis?: IORedis;
  _chatbotRateLimitRedisFailed?: boolean;
  _chatbotRateLimitRedisErrorLogged?: boolean;
  _chatbotRateLimitFallbackWarningLogged?: boolean;
}

const fallbackWindow = new Map<string, number[]>();

function getGlobalStore(): RateLimitRedisGlobals {
  return globalThis as unknown as RateLimitRedisGlobals;
}

function logRedisFallbackWarning(reason: string): void {
  const store = getGlobalStore();
  if (store._chatbotRateLimitFallbackWarningLogged) {
    return;
  }
  console.warn(`Chatbot rate limiter Redis unavailable (${reason}). Using in-memory fallback.`);
  store._chatbotRateLimitFallbackWarningLogged = true;
}

function getRedisClient(): IORedis | null {
  const globalStore = getGlobalStore();
  if (globalStore._chatbotRateLimitRedisFailed) {
    return null;
  }
  if (globalStore._chatbotRateLimitRedis) {
    return globalStore._chatbotRateLimitRedis;
  }

  try {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    redis.on("error", (error) => {
      const store = getGlobalStore();
      if (!store._chatbotRateLimitRedisErrorLogged) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "connection error";
        logRedisFallbackWarning(message);
        store._chatbotRateLimitRedisErrorLogged = true;
      }
      if (process.env.NODE_ENV === "production") {
        store._chatbotRateLimitRedisFailed = true;
      }
    });

    globalStore._chatbotRateLimitRedis = redis;
    return redis;
  } catch {
    globalStore._chatbotRateLimitRedisFailed = true;
    logRedisFallbackWarning("initialization error");
    return null;
  }
}

function checkInMemoryFallback(ip: string, now: number): ChatbotRateLimitResult {
  const timestamps = (fallbackWindow.get(ip) ?? []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );

  const limited = timestamps.length >= RATE_LIMIT_MAX_REQUESTS;
  if (!limited) {
    timestamps.push(now);
  }

  if (timestamps.length === 0) {
    fallbackWindow.delete(ip);
  } else {
    fallbackWindow.set(ip, timestamps);
  }

  if (!limited) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  const oldest = timestamps[0] ?? now;
  const retryAfterMs = Math.max(0, RATE_LIMIT_WINDOW_MS - (now - oldest));
  return {
    limited: true,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
  };
}

function parseLuaResult(raw: unknown): { limited: boolean; retryAfterSeconds: number } | null {
  if (!Array.isArray(raw) || raw.length < 3) {
    return null;
  }

  const limited = Number(raw[0]) === 1;
  const retryAfterMs = Number(raw[2]);
  return {
    limited,
    retryAfterSeconds:
      limited && Number.isFinite(retryAfterMs)
        ? Math.max(1, Math.ceil(retryAfterMs / 1000))
        : 0,
  };
}

export async function checkChatbotRateLimit(ip: string): Promise<ChatbotRateLimitResult> {
  const now = Date.now();
  const redis = getRedisClient();
  if (!redis) {
    logRedisFallbackWarning("client unavailable");
    return checkInMemoryFallback(ip, now);
  }

  try {
    if (redis.status === "wait") {
      await redis.connect();
    }

    const key = `${RATE_LIMIT_KEY_PREFIX}:${ip}`;
    const member = `${now}-${randomUUID()}`;
    const rawResult = await redis.eval(
      RATE_LIMIT_LUA,
      1,
      key,
      now.toString(),
      RATE_LIMIT_WINDOW_MS.toString(),
      RATE_LIMIT_MAX_REQUESTS.toString(),
      RATE_LIMIT_KEY_TTL_SECONDS.toString(),
      member
    );

    const parsed = parseLuaResult(rawResult);
    if (parsed) {
      return parsed;
    }
  } catch {
    logRedisFallbackWarning("request error");
    return checkInMemoryFallback(ip, now);
  }

  logRedisFallbackWarning("invalid Redis response");
  return checkInMemoryFallback(ip, now);
}
