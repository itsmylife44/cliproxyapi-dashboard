import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** True for non-null, non-array objects. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `value` if it is one of `allowed`. */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : undefined;
}

/** Up to 50 strings of at most 256 chars from a stored array; other entries are dropped. */
export function boundedStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, 50).filter((v): v is string => typeof v === "string" && v.length <= 256);
}

/** A stored object kept opaque, as long as it serializes to at most 8 KiB. */
export function boundedObject(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) && JSON.stringify(value).length <= 8192 ? value : undefined;
}

const HTML_ENTITIES: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&#39;": "'", "&#34;": '"', "&amp;": "&" };

/** Reverses Go's html.EscapeString, which CLIProxyAPI applies to management display strings; "" for non-strings. */
export function decodeHtmlEntities(value: unknown): string {
  return typeof value === "string" ? value.replace(/&(lt|gt|#39|#34|amp);/g, (m) => HTML_ENTITIES[m] ?? m) : "";
}

/**
 * Extract a human-readable error message from an API response body.
 * Handles both legacy `{ error: "string" }` and new `{ error: { code, message } }` shapes.
 */
export function extractApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const obj = data as Record<string, unknown>;
  if (typeof obj.error === "string") return obj.error;
  if (typeof obj.error === "object" && obj.error !== null) {
    const err = obj.error as Record<string, unknown>;
    if (typeof err.message === "string") return err.message;
  }
  return fallback;
}
