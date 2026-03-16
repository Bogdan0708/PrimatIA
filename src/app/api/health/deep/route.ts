import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLLMConfig } from "@/lib/ai/config";
import { ensureRedisConnection } from "@/lib/redis";
import { logError, getRequestLogContext } from "@/lib/logger";
import { auth } from "@/lib/auth";

async function checkDatabase() {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : "Database unreachable",
    };
  }
}

async function checkRedis() {
  if (!process.env.REDIS_URL) {
    if (process.env.NODE_ENV === "production") {
      return { status: "error", message: "REDIS_URL not configured" };
    }
    return { status: "skipped", message: "REDIS_URL not configured" };
  }

  const start = Date.now();
  try {
    const redis = await ensureRedisConnection();
    const pong = await redis.ping();
    return {
      status: pong === "PONG" ? "ok" : "error",
      latencyMs: Date.now() - start,
      message: pong === "PONG" ? undefined : `Unexpected ping response: ${pong}`,
    };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : "Redis unavailable",
    };
  }
}

async function checkAiProvider() {
  const config = getLLMConfig();
  if (config.provider === "none") {
    return { status: "skipped", provider: "none", message: "No AI provider configured" };
  }

  if (config.provider !== "gateway" || !config.baseUrl) {
    return {
      status: "configured",
      provider: config.provider,
      model: config.model,
    };
  }

  const start = Date.now();
  try {
    const response = await fetch(new URL("/health", config.baseUrl), {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      cache: "no-store",
    });

    return {
      status: response.ok ? "ok" : "error",
      provider: config.provider,
      model: config.model,
      latencyMs: Date.now() - start,
      httpStatus: response.status,
    };
  } catch (error) {
    return {
      status: "error",
      provider: config.provider,
      model: config.model,
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : "AI gateway unavailable",
    };
  }
}

export async function GET(request: NextRequest) {
  // SECURITY: Require API key or authenticated staff access to prevent topology leakage.
  const healthKey = process.env.HEALTH_CHECK_SECRET;
  if (healthKey) {
    const authHeader = request.headers.get("authorization");
    const providedKey = authHeader?.replace(/^Bearer\s+/i, "");
    if (providedKey !== healthKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const session = await auth();
    if (!session?.user?.tenantId || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const logContext = getRequestLogContext(request);
  const [database, redis, ai] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkAiProvider(),
  ]);

  const aiDegraded = ai.status === "error";
  const status =
    database.status === "ok" && redis.status === "ok"
      ? "ok"
      : "error";

  if (status === "error" || aiDegraded) {
    logError(
      {
        message: aiDegraded && status === "ok"
          ? "Deep health check OK but AI gateway degraded"
          : "Deep health check reported degraded dependencies",
        ...logContext,
        databaseStatus: database.status,
        redisStatus: redis.status,
        aiStatus: ai.status,
      }
    );
  }

  return NextResponse.json(
    {
      status,
      ...(aiDegraded && { aiDegraded: true }),
      timestamp: new Date().toISOString(),
      database,
      redis,
      ai,
    },
    { status: status === "ok" ? 200 : 503 }
  );
}
