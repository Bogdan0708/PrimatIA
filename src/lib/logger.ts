import { NextRequest, NextResponse } from "next/server";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogValue = unknown;
type LogFields = Record<string, unknown>;

function shouldLog(level: LogLevel): boolean {
  const levels: LogLevel[] = ["debug", "info", "warn", "error"];
  const configured =
    (process.env.LOG_LEVEL as LogLevel | undefined) ??
    (process.env.NODE_ENV === "production" ? "info" : "debug");

  return levels.indexOf(level) >= levels.indexOf(configured);
}

function sanitizeValue(value: unknown): LogValue {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (typeof value === "object") {
    return sanitizeFields(value as Record<string, unknown>);
  }

  return String(value);
}

function sanitizeFields(fields: LogFields): LogFields {
  const redactedKeys = new Set([
    "authorization",
    "cnp",
    "cookie",
    "password",
    "passwordHash",
    "token",
    "totpSecret",
  ]);

  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => {
      if (redactedKeys.has(key)) {
        return [key, "[REDACTED]"];
      }
      return [key, sanitizeValue(value)];
    })
  );
}

function writeLog(level: LogLevel, fields: LogFields, message: string) {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...sanitizeFields(fields),
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

type BaseLogger = {
  child(bindings: LogFields): BaseLogger;
  debug(fields: LogFields, message: string): void;
  info(fields: LogFields, message: string): void;
  warn(fields: LogFields, message: string): void;
  error(fields: LogFields, message: string): void;
};

function createLogger(bindings: LogFields = {}): BaseLogger {
  return {
    child(childBindings: LogFields) {
      return createLogger({ ...bindings, ...childBindings });
    },
    debug(fields: LogFields, message: string) {
      writeLog("debug", { ...bindings, ...fields }, message);
    },
    info(fields: LogFields, message: string) {
      writeLog("info", { ...bindings, ...fields }, message);
    },
    warn(fields: LogFields, message: string) {
      writeLog("warn", { ...bindings, ...fields }, message);
    },
    error(fields: LogFields, message: string) {
      writeLog("error", { ...bindings, ...fields }, message);
    },
  };
}

export const logger = createLogger();
export type Logger = BaseLogger;

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

export function ensureRequestId(request: NextRequest): string {
  const existingRequestId = request.headers.get("x-request-id");
  if (existingRequestId) {
    return existingRequestId;
  }

  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getRequestLogContext(
  request: Request | NextRequest,
  extras?: Record<string, unknown>
) {
  const route =
    "nextUrl" in request && request.nextUrl
      ? request.nextUrl.pathname
      : new URL(request.url).pathname;

  const requestId =
    "nextUrl" in request
      ? ensureRequestId(request as NextRequest)
      : request.headers.get("x-request-id");

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

export interface LogContext {
  message: string;
  requestId?: string | null;
  route?: string;
  method?: string;
  tenantId?: string | null;
  userId?: string | null;
  citizenUserId?: string | null;
  [key: string]: unknown;
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
