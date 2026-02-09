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

function createLogStorageStream() {
  return {
    write(chunk: string) {
      try {
        const parsed = JSON.parse(chunk) as LogEntry;
        if (!parsed.levelLabel && parsed.level) {
          parsed.levelLabel = LEVEL_LABELS[parsed.level] ?? "unknown";
        }
        addLog(parsed);
      } catch {
      }
    },
  };
}

const streams: pino.StreamEntry[] = [
  { stream: createLogStorageStream() },
];

if (env.NODE_ENV === "development") {
  const pretty = pino.transport({
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  });
  streams.push({ stream: pretty });
} else {
  streams.push({ stream: process.stdout });
}

export const logger = pino(
  { level: env.LOG_LEVEL },
  pino.multistream(streams)
);

export default logger;
