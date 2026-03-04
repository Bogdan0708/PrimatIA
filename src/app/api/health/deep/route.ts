import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface ComponentHealth {
  status: "ok" | "error";
  latencyMs: number;
  error?: string;
}

async function checkDatabase(): Promise<ComponentHealth> {
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function checkRedis(): Promise<ComponentHealth> {
  const start = performance.now();
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return { status: "ok", latencyMs: 0, error: "Not configured (optional)" };
  }

  try {
    const IORedis = (await import("ioredis")).default;
    const client = new IORedis(redisUrl, {
      connectTimeout: 3000,
      maxRetriesPerRequest: 0,
      lazyConnect: true,
    });
    await client.connect();
    await client.ping();
    const latency = Math.round(performance.now() - start);
    await client.quit();
    return { status: "ok", latencyMs: latency };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function checkAIGateway(): Promise<ComponentHealth> {
  const start = performance.now();
  try {
    const { getLLMConfig } = await import("@/lib/ai/config");
    const config = getLLMConfig();

    if (config.provider === "none") {
      return { status: "ok", latencyMs: 0, error: "No AI provider configured (optional)" };
    }

    if (config.provider === "gateway" && config.baseUrl) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      try {
        const resp = await fetch(`${config.baseUrl}/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return {
          status: resp.ok ? "ok" : "error",
          latencyMs: Math.round(performance.now() - start),
          ...(resp.ok ? {} : { error: `HTTP ${resp.status}` }),
        };
      } catch {
        clearTimeout(timeout);
        return {
          status: "error",
          latencyMs: Math.round(performance.now() - start),
          error: "Gateway unreachable or timeout",
        };
      }
    }

    // Non-gateway providers (claude, openai, lm_studio) — assume ok if configured
    return { status: "ok", latencyMs: 0 };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * GET /api/health/deep
 *
 * Deep health check: DB + Redis + AI Gateway.
 * Returns 503 only if DB is down (critical). Redis/AI are non-critical.
 * NOT used for Cloud Run liveness/readiness probes (too slow).
 */
export async function GET() {
  const [db, redis, ai] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkAIGateway(),
  ]);

  const overall = db.status === "ok" ? "ok" : "degraded";
  const httpStatus = db.status === "ok" ? 200 : 503;

  return NextResponse.json(
    {
      status: overall,
      timestamp: new Date().toISOString(),
      revision: process.env.K_REVISION || "local",
      components: { db, redis, ai },
    },
    { status: httpStatus }
  );
}
