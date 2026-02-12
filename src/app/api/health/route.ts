import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: { status: string; latencyMs?: number; error?: string };
    redis: { status: string; error?: string };
    minio: { status: string; error?: string };
  };
}

export async function GET() {
  const checks: HealthStatus["checks"] = {
    database: { status: "unknown" },
    redis: { status: "unknown" },
    minio: { status: "unknown" },
  };

  // Check PostgreSQL
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = {
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  // Check Redis
  try {
    const { default: Redis } = await import("ioredis");
    const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    await redis.connect();
    await redis.ping();
    checks.redis = { status: "ok" };
    await redis.quit();
  } catch (err) {
    checks.redis = {
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  // Check MinIO
  try {
    const { Client } = await import("minio");
    const minio = new Client({
      endPoint: process.env.MINIO_ENDPOINT || "localhost",
      port: parseInt(process.env.MINIO_PORT || "9000"),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY || "primaria_minio",
      secretKey: process.env.MINIO_SECRET_KEY || "primaria_minio_secret",
    });
    await minio.listBuckets();
    checks.minio = { status: "ok" };
  } catch (err) {
    checks.minio = {
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");
  const anyError = Object.values(checks).some((c) => c.status === "error");

  const health: HealthStatus = {
    status: allOk ? "healthy" : anyError ? "unhealthy" : "degraded",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || "0.1.0",
    uptime: process.uptime(),
    checks,
  };

  return NextResponse.json(health, {
    status: health.status === "healthy" ? 200 : 503,
  });
}
