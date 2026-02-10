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

function createDualDestination(pretty: boolean) {
  const stdout = pino.destination(1);
  
  return {
    write(chunk: string) {
      if (pretty) {
        try {
          const parsed = JSON.parse(chunk) as Record<string, unknown>;
          const time = new Date(parsed.time as number).toLocaleTimeString();
          const levelNum = parsed.level as number;
          const level = (LEVEL_LABELS[levelNum] ?? "info").toUpperCase();
          const msg = (parsed.msg as string) || "";
          const extra = Object.keys(parsed)
            .filter(k => !["level", "time", "msg", "pid", "hostname"].includes(k))
            .map(k => `${k}=${JSON.stringify(parsed[k])}`)
            .join(" ");
          stdout.write(`[${time}] ${level}: ${msg}${extra ? " " + extra : ""}\n`);
        } catch {
          stdout.write(chunk);
        }
      } else {
        stdout.write(chunk);
      }
      
      try {
        const parsed = JSON.parse(chunk) as Record<string, unknown>;
        const entry: LogEntry = {
          level: parsed.level as number,
          levelLabel: LEVEL_LABELS[parsed.level as number] ?? "unknown",
          time: parsed.time as number,
          msg: (parsed.msg as string) || "",
        };
        for (const [key, value] of Object.entries(parsed)) {
          if (!["level", "time", "msg", "pid", "hostname"].includes(key)) {
            entry[key] = value;
          }
        }
        addLog(entry);
      } catch {
        // Skip malformed JSON
      }
    },
  };
}

export const logger = pino(
  { level: env.LOG_LEVEL },
  createDualDestination(env.NODE_ENV === "development")
);

export default logger;
