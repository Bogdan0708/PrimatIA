import pino from "pino";

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
