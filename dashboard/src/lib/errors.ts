import { NextResponse } from "next/server";
import type { ZodIssue } from "zod";
import { logger } from "@/lib/logger";

/**
 * Standard Error Codes
 *
 * Categorized by type for consistent API error responses.
 *
 * @example
 * // Usage in API routes:
 * return apiError(ERROR_CODE.VALIDATION_ERROR, "Invalid input", 400, zodIssues);
 * return apiError(ERROR_CODE.AUTH_FAILED, "Invalid credentials", 401);
 */
export const ERROR_CODE = {
  // ============================================
  // AUTH_* - Authentication & Authorization
  // ============================================

  /** User credentials are invalid (wrong username/password) */
  AUTH_FAILED: "AUTH_FAILED",

  /** JWT or session token has expired */
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",

  /** User is authenticated but lacks required permissions */
  AUTH_INSUFFICIENT_PERMISSIONS: "AUTH_INSUFFICIENT_PERMISSIONS",

  /** No valid session or token provided */
  AUTH_UNAUTHORIZED: "AUTH_UNAUTHORIZED",

  // ============================================
  // VALIDATION_* - Input Validation
  // ============================================

  /** Generic validation error (use details for specifics) */
  VALIDATION_ERROR: "VALIDATION_ERROR",

  /** Zod schema validation failed (details contains ZodIssue[]) */
  VALIDATION_SCHEMA_ERROR: "VALIDATION_SCHEMA_ERROR",

  /** Required fields are missing */
  VALIDATION_MISSING_FIELDS: "VALIDATION_MISSING_FIELDS",

  /** Field value is outside allowed range or format */
  VALIDATION_INVALID_FORMAT: "VALIDATION_INVALID_FORMAT",

  // ============================================
  // RATE_LIMIT_* - Rate Limiting
  // ============================================

  /** Request rate limit exceeded */
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // ============================================
  // NOT_FOUND_* - Resource Not Found
  // ============================================

  /** Generic resource not found */
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",

  /** Specific user not found */
  USER_NOT_FOUND: "USER_NOT_FOUND",

  /** API key or token not found */
  KEY_NOT_FOUND: "KEY_NOT_FOUND",

  /** Provider configuration not found */
  PROVIDER_NOT_FOUND: "PROVIDER_NOT_FOUND",

  // ============================================
  // CONFLICT_* - Resource Conflicts
  // ============================================

  /** Generic resource already exists */
  RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",

  /** Initial setup has already been completed */
  SETUP_ALREADY_COMPLETED: "SETUP_ALREADY_COMPLETED",

  /** API key already contributed by this user */
  KEY_ALREADY_EXISTS: "KEY_ALREADY_EXISTS",

  /** User has reached limit for this resource */
  LIMIT_REACHED: "LIMIT_REACHED",

  // ============================================
  // PROVIDER_* - Provider-specific
  // ============================================

  /** Invalid provider specified */
  PROVIDER_INVALID: "PROVIDER_INVALID",

  /** Provider operation failed */
  PROVIDER_ERROR: "PROVIDER_ERROR",

  // ============================================
  // INTERNAL_* - Server Errors
  // ============================================

  /** Generic internal server error */
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",

  /** Database operation failed */
  DATABASE_ERROR: "DATABASE_ERROR",

  /** Configuration error */
  CONFIG_ERROR: "CONFIG_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

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
 * Standard API success response format
 */
export interface APISuccessResponse<T = unknown> {
  data: T;
}

/**
 * Custom error class for API errors
 *
 * @example
 * throw new APIError(ERROR_CODE.AUTH_FAILED, "Invalid credentials", 401);
 * throw new APIError(ERROR_CODE.VALIDATION_ERROR, "Invalid input", 400, zodIssues);
 */
export class APIError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly userMessage: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(userMessage);
    this.name = "APIError";
  }

  /**
   * Convert to NextResponse JSON
   */
  toResponse(): NextResponse<APIErrorResponse> {
    return NextResponse.json(
      {
        error: {
          code: this.code,
          message: this.userMessage,
          ...(this.details !== undefined && { details: this.details }),
        },
      },
      { status: this.status }
    );
  }

  /**
   * Convert to NextResponse JSON with additional headers
   */
  toResponseWithHeaders(
    headers: Record<string, string>
  ): NextResponse<APIErrorResponse> {
    return NextResponse.json(
      {
        error: {
          code: this.code,
          message: this.userMessage,
          ...(this.details !== undefined && { details: this.details }),
        },
      },
      { status: this.status, headers }
    );
  }
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
 * Create a standard success response
 *
 * @example
 * return apiSuccess({ user: { id: "123", name: "John" } });
 * return apiSuccess({ items: [] }, 201);
 */
export function apiSuccess<T>(
  data: T,
  status = 200
): NextResponse<APISuccessResponse<T>> {
  return NextResponse.json({ data }, { status });
}

/**
 * Handle unknown errors and return standardized response
 *
 * Logs the error and returns a generic internal server error response.
 * Use at the end of catch blocks for unexpected errors.
 *
 * @example
 * try {
 *   // ...
 * } catch (error) {
 *   if (error instanceof APIError) {
 *     return error.toResponse();
 *   }
 *   return handleUnexpectedError(error, "Operation failed");
 * }
 */
export function handleUnexpectedError(
  error: unknown,
  context: string
): NextResponse<APIErrorResponse> {
  logger.error({ err: error, context }, context);
  return apiError(
    ERROR_CODE.INTERNAL_SERVER_ERROR,
    "Internal server error",
    500
  );
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
