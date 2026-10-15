/**
 * Standard Error Codes
 *
 * Categorized by type for consistent API error responses.
 * Dependency-free so client code can match `error.code` too; server code
 * keeps importing it via `@/lib/errors`.
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

  /** The host .env that pins the CLIProxyAPI image is not mounted writable */
  PROXY_VERSION_PIN_UNAVAILABLE: "PROXY_VERSION_PIN_UNAVAILABLE",

  // ============================================
  // INTERNAL_* - Server Errors
  // ============================================

  /** Generic internal server error */
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",

  /** Database operation failed */
  DATABASE_ERROR: "DATABASE_ERROR",

  /** Configuration error */
  CONFIG_ERROR: "CONFIG_ERROR",

  /** Upstream/external service failure */
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];
