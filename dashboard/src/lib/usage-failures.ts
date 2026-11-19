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

export interface SummarizedFailureReason {
  key: string;
  status: number | null;
  code: string | null;
  message: string | null;
  cancelled: boolean;
}

const MAX_REASON_MESSAGE_LENGTH = 240;

function normalizeReasonMessage(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > MAX_REASON_MESSAGE_LENGTH
    ? `${cleaned.slice(0, MAX_REASON_MESSAGE_LENGTH - 1)}\u2026`
    : cleaned;
}

function unescapeJsonFragment(value: string): string {
  return value
    .replace(/\\"/g, '"')
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\\/g, "\\");
}

function pickNonGenericCode(...candidates: unknown[]): string | null {
  let fallback: string | null = null;
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (trimmed.toLowerCase() === "error") {
      fallback ??= trimmed;
      continue;
    }
    return trimmed;
  }
  return fallback;
}

function extractFromJsonPayload(raw: string): {
  status: number | null;
  code: string | null;
  message: string | null;
} {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const errObj =
      parsed.error && typeof parsed.error === "object" && !Array.isArray(parsed.error)
        ? (parsed.error as Record<string, unknown>)
        : null;
    const detailsObj =
      errObj?.details && typeof errObj.details === "object" && !Array.isArray(errObj.details)
        ? (errObj.details as Record<string, unknown>)
        : null;

    let status: number | null = null;
    const numericCode = errObj?.code ?? parsed.code ?? parsed.status_code;
    if (typeof numericCode === "number" && Number.isFinite(numericCode) && numericCode >= 100 && numericCode <= 599) {
      status = Math.trunc(numericCode);
    }

    const code = pickNonGenericCode(
      detailsObj?.error_code,
      errObj?.code,
      errObj?.status,
      errObj?.type,
      parsed.code,
      parsed.type,
    );

    const messageCandidate =
      (typeof errObj?.message === "string" && errObj.message) ||
      (typeof parsed.detail === "string" && parsed.detail) ||
      (typeof parsed.message === "string" && parsed.message) ||
      null;

    return {
      status,
      code,
      message: normalizeReasonMessage(messageCandidate),
    };
  } catch {
    // Failure bodies are truncated at MAX_FAILURE_BODY_LENGTH (500 chars), so JSON payloads
    // may be cut off before the closing brace. Extract structured fields with regex fallback.
    const statusMatch = raw.match(/"(?:code|status_code)"\s*:\s*(\d{3})\b/);
    const status = statusMatch ? Number(statusMatch[1]) : null;

    const errorCodeMatch = raw.match(/"error_code"\s*:\s*"([^"]+)"/);
    const statusStrMatch = raw.match(/"status"\s*:\s*"([A-Z0-9_]+)"/);
    const codeStrMatch = raw.match(/"code"\s*:\s*"([^"]+)"/);
    const typeMatches = Array.from(raw.matchAll(/"type"\s*:\s*"([^"]+)"/g), (m) => m[1]);
    const code = pickNonGenericCode(
      errorCodeMatch?.[1],
      codeStrMatch?.[1],
      statusStrMatch?.[1],
      ...typeMatches,
    );

    const msgMatch =
      raw.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/) ??
      raw.match(/"detail"\s*:\s*"((?:[^"\\]|\\.)*)"/) ??
      raw.match(/"message"\s*:\s*"([^"]*)$/) ??
      raw.match(/"detail"\s*:\s*"([^"]*)$/);
    const message = normalizeReasonMessage(msgMatch?.[1] ? unescapeJsonFragment(msgMatch[1]) : raw);

    return { status, code, message };
  }
}

/**
 * Extracts a normalized, deduplicatable failure reason signature (HTTP status, error code,
 * and concise message) from a failed usage record.
 */
export function summarizeFailureReason(
  failureStatus: number | null,
  failureCode: string | null,
  failureBody: string | null,
): SummarizedFailureReason {
  const cancelled = isCancelledFailure(true, failureStatus, failureCode, failureBody);
  let status = failureStatus;
  let code = failureCode?.trim() || null;
  let message: string | null = null;

  const trimmedBody = failureBody?.trim() ?? "";
  if (trimmedBody) {
    if (trimmedBody.startsWith("{")) {
      const extracted = extractFromJsonPayload(trimmedBody);
      status = status ?? extracted.status;
      code = code ?? extracted.code;
      message = extracted.message;
    } else {
      message = normalizeReasonMessage(trimmedBody);
    }
  }

  const key = `${status ?? "none"}|${code ?? "none"}|${cancelled ? "1" : "0"}|${message ?? "none"}`;
  return { key, status, code, message, cancelled };
}
