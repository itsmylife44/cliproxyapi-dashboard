import "server-only";
import pino from "pino";
import { env } from "./env";

/**
 * Structured logger using Pino.
 *
 * - Development: pretty-printed, colorized logs
 * - Production: JSON formatted logs for log aggregation
 *
 * Log levels configurable via LOG_LEVEL environment variable.
 * Supports request-ID correlation via child loggers.
 *
 * @example
 * // Basic usage
 * logger.info("Server started");
 * logger.error({ err: error }, "Failed to process request");
 *
 * // With context
 * logger.error({
 *   err: error,
 *   userId: session.userId,
 *   operation: "contributeKey"
 * }, "Failed to contribute provider key");
 *
 * // Request-scoped logger (future)
 * const reqLogger = logger.child({ requestId: "abc123" });
 * reqLogger.info("Processing request");
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
});

export default logger;
