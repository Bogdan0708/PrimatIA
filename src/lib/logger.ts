import pino from "pino";
import { NextRequest, NextResponse } from "next/server";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  redact: {
    paths: [
      "cnp",
      "password",
      "passwordHash",
      "token",
      "authorization",
      "cookie",
      "totpSecret",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        },
      }),
});

export function createRequestLogger(
  route: string,
  requestId?: string,
  tenantId?: string,
  userId?: string
) {
  return logger.child({
    route,
    ...(requestId && { requestId }),
    ...(tenantId && { tenantId }),
    ...(userId && { userId }),
  });
}

export type Logger = pino.Logger;

// ── Helpers from local needed for middleware and API routes ───────────

export function ensureRequestId(request: NextRequest): string {
  if (request.headers.get("x-request-id")) {
    return request.headers.get("x-request-id")!;
  }

  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getRequestLogContext(
  request: Request | NextRequest,
  extras?: Record<string, any>
) {
  const route =
    "nextUrl" in request && request.nextUrl
      ? request.nextUrl.pathname
      : new URL(request.url).pathname;

  const requestId = "nextUrl" in request 
    ? ensureRequestId(request as NextRequest) 
    : request.headers.get("x-request-id") || null;

  return {
    requestId,
    route,
    method: request.method,
    ...extras,
  };
}

export function attachRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set("x-request-id", requestId);
  return response;
}

// ── Wrappers for local code compatibility ───────────────────────────

export interface LogContext {
  message: string;
  requestId?: string | null;
  route?: string;
  method?: string;
  tenantId?: string | null;
  userId?: string | null;
  citizenUserId?: string | null;
  [key: string]: any;
}

export function logInfo(context: LogContext) {
  const { message, ...rest } = context;
  logger.info(rest, message);
}

export function logWarn(context: LogContext) {
  const { message, ...rest } = context;
  logger.warn(rest, message);
}

export function logError(context: LogContext, error?: unknown) {
  const { message, ...rest } = context;
  logger.error({ err: error, ...rest }, message);
}
