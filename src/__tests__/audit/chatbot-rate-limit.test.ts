import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("checkChatbotRateLimit", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    delete (globalThis as { _chatbotRateLimitRedis?: unknown })._chatbotRateLimitRedis;
    delete (globalThis as { _chatbotRateLimitRedisFailed?: unknown })._chatbotRateLimitRedisFailed;
    delete (globalThis as { _chatbotRateLimitRedisErrorLogged?: unknown })._chatbotRateLimitRedisErrorLogged;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("fails closed in production when Redis is unavailable", async () => {
    process.env = { ...process.env, NODE_ENV: "production" };
    delete process.env.REDIS_URL;

    const { checkChatbotRateLimit } = await import("@/lib/rate-limit/chatbot-rate-limit");
    const result = await checkChatbotRateLimit("203.0.113.10");

    expect(result).toEqual({ limited: true, retryAfterSeconds: 60 });
  });

  it("falls back to in-memory limiting outside production", async () => {
    process.env = { ...process.env, NODE_ENV: "test" };
    delete process.env.REDIS_URL;

    const { checkChatbotRateLimit } = await import("@/lib/rate-limit/chatbot-rate-limit");
    const result = await checkChatbotRateLimit("203.0.113.11");

    expect(result).toEqual({ limited: false, retryAfterSeconds: 0 });
  });

  it("fails closed in production when Redis errors", async () => {
    process.env = { ...process.env, NODE_ENV: "production" };
    process.env.REDIS_URL = "redis://cache.internal:6379";

    vi.doMock("ioredis", () => ({
      default: class MockRedis {
        status = "wait";
        on() {}
        connect() {
          return Promise.reject(new Error("connection refused"));
        }
      },
    }));

    const { checkChatbotRateLimit } = await import("@/lib/rate-limit/chatbot-rate-limit");
    const result = await checkChatbotRateLimit("203.0.113.12");

    expect(result).toEqual({ limited: true, retryAfterSeconds: 60 });
  });
});
