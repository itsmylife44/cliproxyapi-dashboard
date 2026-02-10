import "server-only";
import pino from "pino";
import { env } from "./env";
import { addLog, type LogEntry } from "./log-storage";

const LEVEL_LABELS: Record<number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

const LEVEL_NUMBERS: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

function createDualDestination(pretty: boolean) {
  const stdout = pino.destination(1);
  
  return {
    write(chunk: string) {
      if (pretty) {
        try {
          const entry = JSON.parse(chunk) as LogEntry;
          const time = new Date(entry.time).toLocaleTimeString();
          const level = (entry.levelLabel ?? LEVEL_LABELS[entry.level] ?? "info").toUpperCase();
          const msg = entry.msg || "";
          const extra = Object.keys(entry)
            .filter(k => !["level", "levelLabel", "time", "msg", "pid", "hostname"].includes(k))
            .map(k => `${k}=${JSON.stringify(entry[k as keyof LogEntry])}`)
            .join(" ");
          stdout.write(`[${time}] ${level}: ${msg}${extra ? " " + extra : ""}\n`);
        } catch {
          stdout.write(chunk);
        }
      } else {
        stdout.write(chunk);
      }
      
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

function createLogger() {
  const isDev = env.NODE_ENV === "development";
  
  const baseLogger = pino(
    { level: env.LOG_LEVEL },
    createDualDestination(isDev)
  );
  
  const logMethods = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
  
  const wrappedLogger: Record<string, unknown> = {};
  
  for (const method of logMethods) {
    const original = baseLogger[method].bind(baseLogger);
    wrappedLogger[method] = function(
      this: unknown,
      objOrMsg?: Record<string, unknown> | string,
      msg?: string,
      ...args: unknown[]
    ) {
      const entry: LogEntry = {
        level: LEVEL_NUMBERS[method],
        levelLabel: method,
        time: Date.now(),
        msg: "",
      };
      
      if (typeof objOrMsg === "string") {
        entry.msg = objOrMsg;
        addLog(entry);
        return (original as (msg: string) => void)(objOrMsg);
      }
      
      if (typeof objOrMsg === "object" && objOrMsg !== null) {
        Object.assign(entry, objOrMsg);
        if (typeof msg === "string") {
          entry.msg = msg;
        }
        addLog(entry);
        return (original as (obj: object, msg?: string, ...args: unknown[]) => void)(objOrMsg, msg, ...args);
      }
      
      addLog(entry);
      return (original as (msg: string) => void)("");
    };
  }
  
  wrappedLogger.child = baseLogger.child.bind(baseLogger);
  wrappedLogger.level = baseLogger.level;
  wrappedLogger.isLevelEnabled = baseLogger.isLevelEnabled.bind(baseLogger);
  
  return wrappedLogger as unknown as pino.Logger;
}

export const logger = createLogger();
export default logger;
