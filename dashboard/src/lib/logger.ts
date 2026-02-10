import "server-only";
import pino from "pino";
import { env } from "./env";
import { addLog, type LogEntry } from "./log-storage";

// Level number to label mapping (Pino standard)
const LEVEL_LABELS: Record<number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

/**
 * Custom destination that writes to both stdout and log-storage.
 */
function createDualDestination() {
  const stdout = pino.destination(1); // fd 1 = stdout
  
  return {
    write(chunk: string) {
      // Write to stdout
      stdout.write(chunk);
      
      // Parse and store in log-storage
      try {
        const entry = JSON.parse(chunk) as LogEntry;
        if (!entry.levelLabel && entry.level) {
          entry.levelLabel = LEVEL_LABELS[entry.level] ?? "unknown";
        }
        addLog(entry);
      } catch {
        // Skip malformed JSON
      }
    },
  };
}

/**
 * Structured logger using Pino.
 *
 * - Development: pretty-printed, colorized logs + stored in log-storage
 * - Production: JSON formatted logs for log aggregation + stored in log-storage
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
export const logger = pino(
  {
    level: env.LOG_LEVEL,
    ...(env.NODE_ENV === "development"
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
              destination: 1, // stdout
            },
          },
        }
      : {}),
  },
  // In production, use dual destination to store logs
  env.NODE_ENV !== "development" ? createDualDestination() : undefined
);

// In development with pino-pretty, we need a separate hook to capture logs
if (env.NODE_ENV === "development") {
  // Override the logger to also store logs
  const originalLogger = logger;
  const logMethods = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
  
  logMethods.forEach((method) => {
    const original = originalLogger[method].bind(originalLogger);
    // @ts-expect-error - we're overriding the method
    originalLogger[method] = (...args: Parameters<typeof original>) => {
      // Store the log entry
      const level = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 }[method];
      const entry: LogEntry = {
        level,
        levelLabel: method,
        time: Date.now(),
        msg: typeof args[0] === "string" ? args[0] : (args[1] as string) ?? "",
        ...(typeof args[0] === "object" ? args[0] : {}),
      };
      addLog(entry);
      
      // Call original
      return original(...args);
    };
  });
}

export default logger;
