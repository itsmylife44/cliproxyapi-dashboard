import { NextResponse } from "next/server";
import type { ZodIssue } from "zod";
import { logger } from "@/lib/logger";
import { ERROR_CODE, type ErrorCode } from "@/lib/error-codes";

export { ERROR_CODE, type ErrorCode };

/**
 * Standard API error response format
 */
export interface APIErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * Transform Zod issues to a structured format
 *
 * @example
 * const result = schema.safeParse(data);
 * if (!result.success) {
 *   return apiError(
 *     ERROR_CODE.VALIDATION_SCHEMA_ERROR,
 *     "Validation failed",
 *     400,
 *     transformZodErrors(result.error.issues)
 *   );
 * }
 */
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
 * Create a standard error response
 *
 * @example
 * // Simple error
 * return apiError(ERROR_CODE.AUTH_FAILED, "Invalid credentials", 401);
 *
 * // With details
 * return apiError(ERROR_CODE.VALIDATION_ERROR, "Invalid input", 400, { field: "email" });
 *
 * // With Zod errors
 * return apiError(
 *   ERROR_CODE.VALIDATION_SCHEMA_ERROR,
 *   "Validation failed",
 *   400,
 *   transformZodErrors(result.error.issues)
 * );
 */
export function apiError(
  code: ErrorCode,
  message: string,
  status: number,
  details?: unknown
): NextResponse<APIErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details !== undefined && { details }),
      },
    },
    { status }
  );
}

/**
 * Create a standard error response with additional headers
 *
 * @example
 * return apiErrorWithHeaders(
 *   ERROR_CODE.RATE_LIMIT_EXCEEDED,
 *   "Too many requests",
 *   429,
 *   undefined,
 *   { "Retry-After": "60" }
 * );
 */
export function apiErrorWithHeaders(
  code: ErrorCode,
  message: string,
  status: number,
  details: unknown | undefined,
  headers: Record<string, string>
): NextResponse<APIErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details !== undefined && { details }),
      },
    },
    { status, headers }
  );
}

/**
 * Create a standard success response with consistent envelope
 */
export function apiSuccess<T extends Record<string, unknown>>(
  data: T,
  status = 200
): NextResponse {
  return NextResponse.json({ success: true, ...Object.fromEntries(Object.entries(data).filter(([k]) => k !== "success")) }, { status });
}

// ============================================
// Convenience factories for common errors
// ============================================

export const Errors = {
  /** 401 - No valid session */
  unauthorized: () =>
    apiError(ERROR_CODE.AUTH_UNAUTHORIZED, "Unauthorized", 401),

  /** 401 - Invalid credentials */
  invalidCredentials: () =>
    apiError(ERROR_CODE.AUTH_FAILED, "Invalid credentials", 401),

  /** 403 - Lacks permissions */
  forbidden: () =>
    apiError(
      ERROR_CODE.AUTH_INSUFFICIENT_PERMISSIONS,
      "Insufficient permissions",
      403
    ),

  /** 404 - Resource not found */
  notFound: (resource = "Resource") =>
    apiError(ERROR_CODE.RESOURCE_NOT_FOUND, `${resource} not found`, 404),

  /** 400 - Validation error */
  validation: (message: string, details?: unknown) =>
    apiError(ERROR_CODE.VALIDATION_ERROR, message, 400, details),

  /** 400 - Missing required fields */
  missingFields: (fields: string[]) =>
    apiError(
      ERROR_CODE.VALIDATION_MISSING_FIELDS,
      `Missing required fields: ${fields.join(", ")}`,
      400,
      { fields }
    ),

  /** 400 - Zod schema validation failed */
  zodValidation: (issues: ZodIssue[]) =>
    apiError(
      ERROR_CODE.VALIDATION_SCHEMA_ERROR,
      "Validation failed",
      400,
      transformZodErrors(issues)
    ),

  /** 409 - Resource already exists */
  conflict: (message: string) =>
    apiError(ERROR_CODE.RESOURCE_ALREADY_EXISTS, message, 409),

  /** 429 - Rate limit exceeded */
  rateLimited: (retryAfterSeconds: number) =>
    apiErrorWithHeaders(
      ERROR_CODE.RATE_LIMIT_EXCEEDED,
      "Too many requests. Try again later.",
      429,
      undefined,
      { "Retry-After": String(retryAfterSeconds) }
    ),

  /** 502 - Upstream dependency failure */
  badGateway: (context: string, error?: unknown) => {
    if (error) {
      logger.error({ err: error, context }, context);
    }
    return apiError(
      ERROR_CODE.UPSTREAM_ERROR,
      "Upstream service error",
      502
    );
  },

  /** 503 - Service temporarily unavailable */
  serviceUnavailable: (context: string) => {
    logger.warn({ context }, "Service unavailable");
    return apiError(ERROR_CODE.UPSTREAM_ERROR, "Service temporarily unavailable", 503);
  },

  /** 504 - Gateway timeout */
  gatewayTimeout: (context: string) => {
    logger.warn({ context }, "Gateway timeout");
    return apiError(ERROR_CODE.UPSTREAM_ERROR, "Request timed out", 504);
  },

  /** 500 - Internal server error */
  internal: (context: string, error?: unknown) => {
    if (error) {
      logger.error({ err: error, context }, context);
    }
    return apiError(
      ERROR_CODE.INTERNAL_SERVER_ERROR,
      "Internal server error",
      500
    );
  },

  /** 500 - Database error */
  database: (context: string, error?: unknown) => {
    if (error) {
      logger.error({ err: error, context }, `Database error in ${context}`);
    }
    return apiError(ERROR_CODE.DATABASE_ERROR, "Database operation failed", 500);
  },
} as const;
