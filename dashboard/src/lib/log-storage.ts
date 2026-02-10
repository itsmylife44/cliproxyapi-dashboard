import "server-only";
import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";

export interface LogEntry {
  level: number;
  levelLabel: string;
  time: number;
  msg: string;
  [key: string]: unknown;
}

const MAX_MEMORY_LOGS = 1000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_LOG_FILES = 5;
const FLUSH_INTERVAL_MS = 1000;
const LOG_DIR = process.env.LOG_DIR ?? path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");

const LEVEL_LABELS: Record<number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

const memoryLogs: LogEntry[] = [];
const writeBuffer: string[] = [];
let initialized = false;
let flushScheduled = false;
let currentFileSize = 0;
let cachedFileCount = 0;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10000;

function ensureLogDirSync(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (error) {
    console.error("[log-storage] Failed to create log directory:", error);
  }
}

async function rotateLogsIfNeeded(): Promise<void> {
  if (currentFileSize < MAX_FILE_SIZE) return;
  
  try {
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const oldFile = `${LOG_FILE}.${i}`;
      const newFile = `${LOG_FILE}.${i + 1}`;
      try {
        if (i === MAX_LOG_FILES - 1) {
          await fsPromises.unlink(oldFile).catch(() => {});
        } else {
          await fsPromises.rename(oldFile, newFile).catch(() => {});
        }
      } catch {
        // File doesn't exist, skip
      }
    }
    await fsPromises.rename(LOG_FILE, `${LOG_FILE}.1`).catch(() => {});
    currentFileSize = 0;
  } catch (error) {
    console.error("[log-storage] Failed to rotate logs:", error);
  }
}

async function flushBuffer(): Promise<void> {
  if (writeBuffer.length === 0) {
    flushScheduled = false;
    return;
  }
  
  const toWrite = writeBuffer.splice(0, writeBuffer.length).join("");
  
  try {
    await rotateLogsIfNeeded();
    await fsPromises.appendFile(LOG_FILE, toWrite);
    currentFileSize += Buffer.byteLength(toWrite);
  } catch (error) {
    console.error("[log-storage] Failed to write logs to file:", error);
  }
  
  flushScheduled = false;
  
  if (writeBuffer.length > 0) {
    scheduleFlush();
  }
}

function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  setTimeout(() => {
    flushBuffer().catch(console.error);
  }, FLUSH_INTERVAL_MS);
}

function loadLogsFromFile(): void {
  if (initialized) return;
  initialized = true;

  ensureLogDirSync();

  try {
    if (!fs.existsSync(LOG_FILE)) return;

    const stats = fs.statSync(LOG_FILE);
    currentFileSize = stats.size;
    
    const content = fs.readFileSync(LOG_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

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

export function addLog(entry: LogEntry): void {
  if (!initialized) {
    loadLogsFromFile();
  }

  if (!entry.levelLabel && entry.level) {
    entry.levelLabel = LEVEL_LABELS[entry.level] ?? "unknown";
  }

  memoryLogs.push(entry);
  if (memoryLogs.length > MAX_MEMORY_LOGS) {
    memoryLogs.shift();
  }

  const line = JSON.stringify(entry) + "\n";
  writeBuffer.push(line);
  scheduleFlush();
}

export interface GetLogsOptions {
  level?: string;
  limit?: number;
  since?: number;
}

export function getLogs(options: GetLogsOptions = {}): LogEntry[] {
  if (!initialized) {
    loadLogsFromFile();
  }

  const { level, limit, since } = options;

  const levelNumber = level
    ? Object.entries(LEVEL_LABELS).find(([, label]) => label === level)?.[0]
    : undefined;
  const minLevel = levelNumber ? parseInt(levelNumber, 10) : undefined;

  let result = [...memoryLogs];

  if (minLevel !== undefined) {
    result = result.filter((log) => log.level >= minLevel);
  }

  if (since !== undefined && !Number.isNaN(since)) {
    result = result.filter((log) => log.time > since);
  }

  result.reverse();

  if (limit !== undefined && limit > 0) {
    result = result.slice(0, limit);
  }

  return result;
}

export function getLogCount(): number {
  if (!initialized) {
    loadLogsFromFile();
  }
  return memoryLogs.length;
}

function getFileCountCached(): number {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedFileCount;
  }
  
  try {
    if (!fs.existsSync(LOG_FILE)) {
      cachedFileCount = 0;
    } else {
      const content = fs.readFileSync(LOG_FILE, "utf-8");
      cachedFileCount = content.trim().split("\n").filter(Boolean).length;
    }
    cacheTimestamp = now;
  } catch {
    cachedFileCount = 0;
  }
  
  return cachedFileCount;
}

export function clearLogs(): void {
  memoryLogs.length = 0;
  writeBuffer.length = 0;
  currentFileSize = 0;
  cachedFileCount = 0;

  try {
    if (fs.existsSync(LOG_FILE)) {
      fs.unlinkSync(LOG_FILE);
    }

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

export function getLogFilePath(): string {
  return LOG_FILE;
}

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

  let rotatedFiles = 0;

  try {
    for (let i = 1; i <= MAX_LOG_FILES; i++) {
      if (fs.existsSync(`${LOG_FILE}.${i}`)) {
        rotatedFiles++;
      }
    }
  } catch {
    // Ignore
  }

  return {
    memoryCount: memoryLogs.length,
    fileCount: getFileCountCached(),
    fileSizeBytes: currentFileSize,
    rotatedFiles,
    logDir: LOG_DIR,
  };
}
