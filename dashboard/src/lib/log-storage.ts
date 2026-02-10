import "server-only";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * File-based log storage with in-memory ring buffer for fast access.
 * Logs persist across restarts and rotate when file exceeds MAX_FILE_SIZE.
 */

export interface LogEntry {
  level: number;
  levelLabel: string;
  time: number;
  msg: string;
  [key: string]: unknown;
}

// Configuration
const MAX_MEMORY_LOGS = 1000; // Keep last 1000 logs in memory for fast access
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per log file
const MAX_LOG_FILES = 5; // Keep last 5 rotated files
const LOG_DIR = process.env.LOG_DIR ?? path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");

// Level number to label mapping (Pino standard)
const LEVEL_LABELS: Record<number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

// In-memory ring buffer for fast access
const memoryLogs: LogEntry[] = [];

// Track if we've initialized
let initialized = false;

/**
 * Ensure log directory exists
 */
function ensureLogDir(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (error) {
    console.error("[log-storage] Failed to create log directory:", error);
  }
}

/**
 * Rotate log files when current file exceeds MAX_FILE_SIZE
 */
function rotateLogsIfNeeded(): void {
  try {
    if (!fs.existsSync(LOG_FILE)) return;

    const stats = fs.statSync(LOG_FILE);
    if (stats.size < MAX_FILE_SIZE) return;

    // Rotate: app.log -> app.log.1, app.log.1 -> app.log.2, etc.
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const oldFile = `${LOG_FILE}.${i}`;
      const newFile = `${LOG_FILE}.${i + 1}`;
      if (fs.existsSync(oldFile)) {
        if (i === MAX_LOG_FILES - 1) {
          fs.unlinkSync(oldFile); // Delete oldest
        } else {
          fs.renameSync(oldFile, newFile);
        }
      }
    }

    // Move current to .1
    fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
  } catch (error) {
    console.error("[log-storage] Failed to rotate logs:", error);
  }
}

/**
 * Load existing logs from file into memory buffer on startup
 */
function loadLogsFromFile(): void {
  if (initialized) return;
  initialized = true;

  ensureLogDir();

  try {
    if (!fs.existsSync(LOG_FILE)) return;

    const content = fs.readFileSync(LOG_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    // Load last MAX_MEMORY_LOGS entries
    const startIndex = Math.max(0, lines.length - MAX_MEMORY_LOGS);
    for (let i = startIndex; i < lines.length; i++) {
      try {
        const entry = JSON.parse(lines[i]) as LogEntry;
        if (!entry.levelLabel && entry.level) {
          entry.levelLabel = LEVEL_LABELS[entry.level] ?? "unknown";
        }
        memoryLogs.push(entry);
      } catch {
        // Skip malformed lines
      }
    }
  } catch (error) {
    console.error("[log-storage] Failed to load logs from file:", error);
  }
}

/**
 * Add a log entry to both file and memory buffer.
 */
export function addLog(entry: LogEntry): void {
  // Lazy initialization
  if (!initialized) {
    loadLogsFromFile();
  }

  // Add level label if not present
  if (!entry.levelLabel && entry.level) {
    entry.levelLabel = LEVEL_LABELS[entry.level] ?? "unknown";
  }

  // Add to memory buffer (ring buffer)
  memoryLogs.push(entry);
  if (memoryLogs.length > MAX_MEMORY_LOGS) {
    memoryLogs.shift();
  }

  // Write to file (sync for reliability)
  try {
    ensureLogDir();
    rotateLogsIfNeeded();
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
  } catch (error) {
    console.error("[log-storage] Failed to write log to file:", error);
  }
}

export interface GetLogsOptions {
  level?: string;
  limit?: number;
  since?: number;
}

/**
 * Get logs from the memory buffer with optional filtering.
 *
 * @param options.level - Filter by minimum level (e.g., "error", "warn", "info")
 * @param options.limit - Maximum number of logs to return (default: all)
 * @param options.since - Only return logs after this timestamp (ms)
 * @returns Array of log entries, newest first
 */
export function getLogs(options: GetLogsOptions = {}): LogEntry[] {
  // Lazy initialization
  if (!initialized) {
    loadLogsFromFile();
  }

  const { level, limit, since } = options;

  // Convert level name to number for filtering
  const levelNumber = level
    ? Object.entries(LEVEL_LABELS).find(([, label]) => label === level)?.[0]
    : undefined;
  const minLevel = levelNumber ? parseInt(levelNumber, 10) : undefined;

  let result = [...memoryLogs];

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
 * Get total number of logs in memory buffer.
 */
export function getLogCount(): number {
  if (!initialized) {
    loadLogsFromFile();
  }
  return memoryLogs.length;
}

/**
 * Get total logs on disk (approximate, based on file line count)
 */
export function getTotalLogCount(): number {
  if (!initialized) {
    loadLogsFromFile();
  }

  try {
    if (!fs.existsSync(LOG_FILE)) return memoryLogs.length;

    const content = fs.readFileSync(LOG_FILE, "utf-8");
    const lineCount = content.trim().split("\n").filter(Boolean).length;
    return lineCount;
  } catch {
    return memoryLogs.length;
  }
}

/**
 * Clear all logs from both memory and file.
 */
export function clearLogs(): void {
  memoryLogs.length = 0;

  try {
    // Remove main log file
    if (fs.existsSync(LOG_FILE)) {
      fs.unlinkSync(LOG_FILE);
    }

    // Remove rotated files
    for (let i = 1; i <= MAX_LOG_FILES; i++) {
      const rotatedFile = `${LOG_FILE}.${i}`;
      if (fs.existsSync(rotatedFile)) {
        fs.unlinkSync(rotatedFile);
      }
    }
  } catch (error) {
    console.error("[log-storage] Failed to clear log files:", error);
  }
}

/**
 * Get log file path (for debugging/admin info)
 */
export function getLogFilePath(): string {
  return LOG_FILE;
}

/**
 * Get log storage stats
 */
export function getLogStats(): {
  memoryCount: number;
  fileCount: number;
  fileSizeBytes: number;
  rotatedFiles: number;
  logDir: string;
} {
  if (!initialized) {
    loadLogsFromFile();
  }

  let fileSizeBytes = 0;
  let fileCount = 0;
  let rotatedFiles = 0;

  try {
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      fileSizeBytes = stats.size;
      const content = fs.readFileSync(LOG_FILE, "utf-8");
      fileCount = content.trim().split("\n").filter(Boolean).length;
    }

    for (let i = 1; i <= MAX_LOG_FILES; i++) {
      if (fs.existsSync(`${LOG_FILE}.${i}`)) {
        rotatedFiles++;
      }
    }
  } catch {
    // Ignore errors
  }

  return {
    memoryCount: memoryLogs.length,
    fileCount,
    fileSizeBytes,
    rotatedFiles,
    logDir: LOG_DIR,
  };
}
