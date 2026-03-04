import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("checkDistributedRateLimit", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("fails open when REDIS_URL is not set", async () => {
    delete process.env.REDIS_URL;
    const { checkDistributedRateLimit } = await import("@/lib/rate-limit");

    const result = await checkDistributedRateLimit("rl:test:127.0.0.1", 5, 60);
    expect(result).toEqual({ allowed: true, remaining: 5 });
  });

  it("fails open when Redis connection fails", async () => {
    // Mock ioredis to throw on connect
    vi.doMock("ioredis", () => ({
      default: class MockRedis {
        connect() {
          return Promise.reject(new Error("Connection refused"));
        }
        async incr() {
          throw new Error("Not connected");
        }
        async expire() {
          throw new Error("Not connected");
        }
      },
    }));

    process.env.REDIS_URL = "redis://localhost:6379";
    const { checkDistributedRateLimit } = await import("@/lib/rate-limit");

    const result = await checkDistributedRateLimit("rl:test:127.0.0.1", 5, 60);
    // Should fail open
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
  });

  it("allows requests under the limit when Redis works", async () => {
    vi.doMock("ioredis", () => ({
      default: class MockRedis {
        connect() { return Promise.resolve(); }
        async incr() { return 2; }
        async expire() { return 1; }
      },
    }));

    process.env.REDIS_URL = "redis://localhost:6379";
    const { checkDistributedRateLimit } = await import("@/lib/rate-limit");

    const result = await checkDistributedRateLimit("rl:test:127.0.0.1", 5, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it("blocks requests over the limit", async () => {
    vi.doMock("ioredis", () => ({
      default: class MockRedis {
        connect() { return Promise.resolve(); }
        async incr() { return 6; }
        async expire() { return 1; }
      },
    }));

    process.env.REDIS_URL = "redis://localhost:6379";
    const { checkDistributedRateLimit } = await import("@/lib/rate-limit");

    const result = await checkDistributedRateLimit("rl:test:127.0.0.1", 5, 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
