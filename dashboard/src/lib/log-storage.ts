import "server-only";

/**
 * In-memory ring buffer for storing log entries.
 * Oldest logs are dropped when MAX_LOGS is reached.
 */

export interface LogEntry {
  level: number;
  levelLabel: string;
  time: number;
  msg: string;
  [key: string]: unknown;
}

const MAX_LOGS = 1000;
const logs: LogEntry[] = [];

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
 * Add a log entry to the ring buffer.
 * If buffer is full, oldest entry is removed.
 */
export function addLog(entry: LogEntry): void {
  // Add level label if not present
  if (!entry.levelLabel && entry.level) {
    entry.levelLabel = LEVEL_LABELS[entry.level] ?? "unknown";
  }

  logs.push(entry);

  // Ring buffer: remove oldest when exceeding max
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
}

export interface GetLogsOptions {
  level?: string;
  limit?: number;
  since?: number;
}

/**
 * Get logs from the buffer with optional filtering.
 * 
 * @param options.level - Filter by level (e.g., "error", "warn", "info")
 * @param options.limit - Maximum number of logs to return (default: all)
 * @param options.since - Only return logs after this timestamp (ms)
 * @returns Array of log entries, newest first
 */
export function getLogs(options: GetLogsOptions = {}): LogEntry[] {
  const { level, limit, since } = options;

  // Convert level name to number for filtering
  const levelNumber = level
    ? Object.entries(LEVEL_LABELS).find(([, label]) => label === level)?.[0]
    : undefined;
  const minLevel = levelNumber ? parseInt(levelNumber, 10) : undefined;

  let result = [...logs];

  // Filter by minimum level (e.g., "error" means >= 50)
  if (minLevel !== undefined) {
    result = result.filter((log) => log.level >= minLevel);
  }

  // Filter by timestamp
  if (since !== undefined) {
    result = result.filter((log) => log.time > since);
  }

  // Return newest first
  result.reverse();

  // Apply limit
  if (limit !== undefined && limit > 0) {
    result = result.slice(0, limit);
  }

  return result;
}

/**
 * Get total number of logs in the buffer.
 */
export function getLogCount(): number {
  return logs.length;
}

/**
 * Clear all logs from the buffer.
 */
export function clearLogs(): void {
  logs.length = 0;
}
