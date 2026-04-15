import "server-only";
import { env } from "@/lib/env";

/**
 * SINGLE-INSTANCE CONSTRAINT WARNING
 *
 * This AsyncMutex is IN-PROCESS ONLY and does NOT work across multiple dashboard instances.
 * It only synchronizes concurrent requests within a single Node.js process.
 *
 * Current deployment: Single-instance (sufficient for current architecture)
 * If multi-instance deployment is needed in the future: Replace with Postgres advisory locks
 * or a distributed locking mechanism (Redis Redlock, etc.)
 *
 * Per-provider async mutex to serialize GET-modify-PUT sequences.
 * Prevents race conditions where concurrent requests read the same state,
 * modify independently, and the last write overwrites the first.
 * In-process only — sufficient because dashboard runs as a single Node.js process.
 */
export class AsyncMutex {
  private locks = new Map<string, Promise<void>>();

  async acquire(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let released = false;
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    this.locks.set(key, promise);
    return () => {
      if (released) return;
      released = true;
      if (this.locks.get(key) === promise) {
        this.locks.delete(key);
      }
      resolve();
    };
  }
}

export const providerMutex = new AsyncMutex();

export const MANAGEMENT_BASE_URL = env.CLIPROXYAPI_MANAGEMENT_URL;
export const MANAGEMENT_API_KEY = env.MANAGEMENT_API_KEY;
export const FETCH_TIMEOUT_MS = 10000; // 10 second timeout for all Management API calls

/**
 * Wrapper for fetch with timeout using AbortController.
 * Ensures requests don't hang indefinitely.
 */
export function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timeout);
  });
}

export interface ContributeKeyResult {
  ok: boolean;
  keyHash?: string;
  keyIdentifier?: string;
  error?: string;
}

export interface RemoveKeyResult {
  ok: boolean;
  error?: string;
}

export interface KeyWithOwnership {
  keyHash: string;
  maskedKey: string;
  provider: string;
  ownerUsername: string | null;
  ownerUserId: string | null;
  isOwn: boolean;
}

export interface ListKeysResult {
  ok: boolean;
  keys?: KeyWithOwnership[];
  error?: string;
}

export interface OAuthAccountWithOwnership {
  id: string;
  authId: string | null;
  accountName: string;
  accountEmail: string | null;
  provider: string;
  ownerUsername: string | null;
  ownerUserId: string | null;
  isOwn: boolean;
  status: "active" | "error" | "disabled" | string;
  statusMessage: string | null;
  unavailable: boolean;
  quotaGroups?: OAuthAccountQuotaGroupState[];
}

export interface OAuthAccountQuotaGroupState {
  authId: string;
  groupId: string;
  label: string;
  effectiveStatus: string;
  manualSuspended: boolean;
  manualReason: string | null;
  autoSuspendedUntil: string | null;
  autoReason: string | null;
  sourceModel: string | null;
  sourceProvider: string | null;
  resetTimeSource: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface ListOAuthResult {
  ok: boolean;
  accounts?: OAuthAccountWithOwnership[];
  error?: string;
}

export interface ContributeOAuthResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface RemoveOAuthResult {
  ok: boolean;
  error?: string;
}

export interface ImportOAuthResult {
  ok: boolean;
  id?: string;
  accountName?: string;
  error?: string;
}

export interface ToggleOAuthResult {
  ok: boolean;
  disabled?: boolean;
  error?: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isApiKeyArray(value: unknown): value is Array<{ "api-key": string }> {
  if (!Array.isArray(value)) return false;
  return value.every((item) => isRecord(item) && typeof item["api-key"] === "string");
}

export function isOpenAICompatArray(
  value: unknown
): value is Array<{ name: string; "api-key-entries": Array<{ "api-key": string }> }> {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      isRecord(item) &&
      typeof item.name === "string" &&
      Array.isArray(item["api-key-entries"]) &&
      (item["api-key-entries"] as unknown[]).every(
        (entry) => isRecord(entry) && typeof entry["api-key"] === "string"
      )
  );
}
