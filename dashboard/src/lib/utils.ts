import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** True for non-null, non-array objects. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
