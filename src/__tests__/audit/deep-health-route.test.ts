import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));

const ensureRedisConnectionMock = vi.hoisted(() => vi.fn());
const getLLMConfigMock = vi.hoisted(() => vi.fn());
const logErrorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/redis", () => ({
  ensureRedisConnection: ensureRedisConnectionMock,
}));

vi.mock("@/lib/ai/config", () => ({
  getLLMConfig: getLLMConfigMock,
}));

vi.mock("@/lib/logger", () => ({
  logError: logErrorMock,
  getRequestLogContext: () => ({
    route: "/api/health/deep",
    method: "GET",
    requestId: "req-1",
  }),
}));

describe("GET /api/health/deep", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    ensureRedisConnectionMock.mockResolvedValue({
      ping: vi.fn().mockResolvedValue("PONG"),
    });
    getLLMConfigMock.mockReturnValue({ provider: "none", model: "none" });
    global.fetch = vi.fn();
  });

  it("fails in production when REDIS_URL is missing", async () => {
    process.env = { ...process.env, NODE_ENV: "production" };
    delete process.env.REDIS_URL;

    const { GET } = await import("@/app/api/health/deep/route");
    const response = await GET(new NextRequest("http://localhost/api/health/deep"));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.status).toBe("error");
    expect(payload.redis).toEqual({
      status: "error",
      message: "REDIS_URL not configured",
    });
  });

  it("returns ok when database and Redis are healthy and AI is optional", async () => {
    process.env = { ...process.env, NODE_ENV: "production" };
    process.env.REDIS_URL = "redis://cache.internal:6379";
    getLLMConfigMock.mockReturnValue({ provider: "none", model: "none" });

    const { GET } = await import("@/app/api/health/deep/route");
    const response = await GET(new NextRequest("http://localhost/api/health/deep"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("ok");
    expect(payload.database.status).toBe("ok");
    expect(payload.redis.status).toBe("ok");
    expect(payload.ai.status).toBe("skipped");
  });

  it("logs and fails when Redis is configured but unavailable", async () => {
    process.env = { ...process.env, NODE_ENV: "production" };
    process.env.REDIS_URL = "redis://cache.internal:6379";
    ensureRedisConnectionMock.mockRejectedValue(new Error("connection refused"));

    const { GET } = await import("@/app/api/health/deep/route");
    const response = await GET(new NextRequest("http://localhost/api/health/deep"));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.status).toBe("error");
    expect(payload.redis.status).toBe("error");
    expect(logErrorMock).toHaveBeenCalled();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });
});
