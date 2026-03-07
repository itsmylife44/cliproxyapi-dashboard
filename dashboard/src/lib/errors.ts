import { NextResponse } from "next/server";
import type { ZodIssue } from "zod";
import { logger } from "@/lib/logger";

export const ERROR_CODE = {
  AUTH_FAILED: "AUTH_FAILED",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_INSUFFICIENT_PERMISSIONS: "AUTH_INSUFFICIENT_PERMISSIONS",
  AUTH_UNAUTHORIZED: "AUTH_UNAUTHORIZED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  VALIDATION_SCHEMA_ERROR: "VALIDATION_SCHEMA_ERROR",
  VALIDATION_MISSING_FIELDS: "VALIDATION_MISSING_FIELDS",
  VALIDATION_INVALID_FORMAT: "VALIDATION_INVALID_FORMAT",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  KEY_NOT_FOUND: "KEY_NOT_FOUND",
  PROVIDER_NOT_FOUND: "PROVIDER_NOT_FOUND",
  RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",
  SETUP_ALREADY_COMPLETED: "SETUP_ALREADY_COMPLETED",
  KEY_ALREADY_EXISTS: "KEY_ALREADY_EXISTS",
  LIMIT_REACHED: "LIMIT_REACHED",
  PROVIDER_INVALID: "PROVIDER_INVALID",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  CONFIG_ERROR: "CONFIG_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export interface TransformedZodError {
  field: string;
  message: string;
  code: string;
}

export function transformZodErrors(issues: ZodIssue[]): TransformedZodError[] {
  return issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Create a standard error response.
 *
 * Produces the same envelope as api-response.ts::apiError:
 *   { success: false, error: "message", code?: "ERROR_CODE", details?: ... }
 *
 * This ensures client code reading `data.error` always gets a string.
 */
export function apiError(
  code: ErrorCode,
  message: string,
  status: number,
  details?: unknown
): NextResponse {
  const body: { success: false; error: string; code: ErrorCode; details?: unknown } = {
    success: false,
    error: message,
    code,
  };
  if (details !== undefined) {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}

export function apiErrorWithHeaders(
  code: ErrorCode,
  message: string,
  status: number,
  details: unknown | undefined,
  headers: Record<string, string>
): NextResponse {
  const body: { success: false; error: string; code: ErrorCode; details?: unknown } = {
    success: false,
    error: message,
    code,
  };
  if (details !== undefined) {
    body.details = details;
  }
  return NextResponse.json(body, { status, headers });
}

export const Errors = {
  unauthorized: () =>
    apiError(ERROR_CODE.AUTH_UNAUTHORIZED, "Unauthorized", 401),

  invalidCredentials: () =>
    apiError(ERROR_CODE.AUTH_FAILED, "Invalid credentials", 401),

  forbidden: () =>
    apiError(ERROR_CODE.AUTH_INSUFFICIENT_PERMISSIONS, "Insufficient permissions", 403),

  notFound: (resource = "Resource") =>
    apiError(ERROR_CODE.RESOURCE_NOT_FOUND, `${resource} not found`, 404),

  validation: (message: string, details?: unknown) =>
    apiError(ERROR_CODE.VALIDATION_ERROR, message, 400, details),

  missingFields: (fields: string[]) =>
    apiError(ERROR_CODE.VALIDATION_MISSING_FIELDS, `Missing required fields: ${fields.join(", ")}`, 400, { fields }),

  zodValidation: (issues: ZodIssue[]) =>
    apiError(ERROR_CODE.VALIDATION_SCHEMA_ERROR, "Validation failed", 400, transformZodErrors(issues)),

  conflict: (message: string) =>
    apiError(ERROR_CODE.RESOURCE_ALREADY_EXISTS, message, 409),

  rateLimited: (retryAfterSeconds: number) =>
    apiErrorWithHeaders(ERROR_CODE.RATE_LIMIT_EXCEEDED, "Too many requests. Try again later.", 429, undefined, { "Retry-After": String(retryAfterSeconds) }),

  internal: (context: string, error?: unknown) => {
    if (error) {
      logger.error({ err: error, context }, context);
    }
    return apiError(ERROR_CODE.INTERNAL_SERVER_ERROR, "Internal server error", 500);
  },

  database: (context: string, error?: unknown) => {
    if (error) {
      logger.error({ err: error, context }, `Database error in ${context}`);
    }
    return apiError(ERROR_CODE.DATABASE_ERROR, "Database operation failed", 500);
  },
} as const;
