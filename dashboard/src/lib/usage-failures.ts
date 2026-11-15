export const MAX_FAILURE_CODE_LENGTH = 128;
export const MAX_FAILURE_BODY_LENGTH = 500;

// Strip ASCII control characters including NUL (\x00) while preserving \t, \n, \r
// so Postgres TEXT never rejects a createMany batch.
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, replacement: "Bearer [REDACTED]" },
  { pattern: /\bsk-[A-Za-z0-9_-]{8,}/g, replacement: "[REDACTED]" },
  { pattern: /\bAIza[0-9A-Za-z_-]{16,}/g, replacement: "[REDACTED]" },
  { pattern: /\bgh[pousr]_[A-Za-z0-9_]{8,}/g, replacement: "[REDACTED]" },
  { pattern: /\bxox[baprs]-[0-9A-Za-z-]{8,}/g, replacement: "[REDACTED]" },
  { pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, replacement: "[REDACTED]" },
];

export interface FailureEntryInput {
  failed?: boolean;
  fail?: {
    status_code?: number;
    body?: string;
    code?: string;
  };
}

export interface ExtractedFailureDetails {
  failureStatus: number | null;
  failureCode: string | null;
  failureBody: string | null;
}

function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHARS_REGEX, "");
}

function redactSensitiveText(value: string): string {
  let redacted = value;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

function sanitizeFailureText(
  value: unknown,
  maxLength: number,
  options?: { redact?: boolean },
): string | null {
  if (typeof value !== "string") return null;
  const cleaned = stripControlChars(value);
  const processed = options?.redact ? redactSensitiveText(cleaned) : cleaned;
  const trimmed = processed.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

/**
 * Extracts bounded, sanitized failure status, code, and body from a failed usage queue entry.
 */
export function extractFailureDetails(entry: FailureEntryInput): ExtractedFailureDetails {
  if (!entry.failed) {
    return { failureStatus: null, failureCode: null, failureBody: null };
  }
  const statusCode = entry.fail?.status_code;
  const failureStatus =
    typeof statusCode === "number" && Number.isFinite(statusCode) && statusCode > 0
      ? Math.trunc(statusCode)
      : null;
  return {
    failureStatus,
    failureCode: sanitizeFailureText(entry.fail?.code, MAX_FAILURE_CODE_LENGTH),
    failureBody: sanitizeFailureText(entry.fail?.body, MAX_FAILURE_BODY_LENGTH, { redact: true }),
  };
}

/**
 * Identifies failed requests that were cancelled by the client (HTTP 499,
 * "canceled" error code, or "context canceled" in the upstream body).
 */
export function isCancelledFailure(
  failed: boolean,
  failureStatus: number | null,
  failureCode: string | null,
  failureBody: string | null,
): boolean {
  if (!failed) return false;
  return (
    failureStatus === 499 ||
    failureCode === "canceled" ||
    (failureBody?.toLowerCase().includes("context canceled") ?? false)
  );
}
