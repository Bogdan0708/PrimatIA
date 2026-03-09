import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logError } from "@/lib/logger";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      revision: process.env.K_REVISION || 'local',
    });
  } catch (error) {
    logError({ message: "Health check failed because database was unreachable", route: "/api/health", method: "GET" }, error);
    return NextResponse.json(
      { status: 'error', message: 'Database unreachable' },
      { status: 503 }
    );
  }
}
