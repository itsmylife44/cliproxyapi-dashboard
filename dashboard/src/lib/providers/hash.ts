import "server-only";
import { createHash } from "crypto";

/**
 * Hash a provider API key using SHA-256.
 * Used for correlation between PostgreSQL ownership records and Management API keys.
 *
 * @param apiKey - The full API key to hash
 * @returns Hex-encoded SHA-256 hash of the API key
 *
 * @example
 * const hash = hashProviderKey("sk-ant-api03-test123");
 * // Returns: "a3c5d8f2..." (64 hex chars)
 */
export function hashProviderKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Mask a provider API key for display.
 * Shows first 8 characters and last 4 characters, masks the rest.
 *
 * @param apiKey - The full API key to mask
 * @returns Masked key string (e.g., "sk-ant-ap...x7Zg")
 *
 * @example
 * maskProviderKey("sk-ant-api03-test123")
 * // Returns: "sk-ant-ap...t123"
 */
export function maskProviderKey(apiKey: string): string {
  if (apiKey.length <= 12) {
    return apiKey;
  }
  const prefix = apiKey.slice(0, 8);
  const suffix = apiKey.slice(-4);
  return `${prefix}...${suffix}`;
}
