/**
 * Barrel re-export for dual-write operations.
 *
 * Implementation split into:
 * - management-api.ts  — shared helpers (AsyncMutex, fetchWithTimeout, types, guards)
 * - api-key-ops.ts     — API key contribute/remove/list operations
 * - oauth-ops.ts       — OAuth account import/list/remove/toggle operations
 */

// API key operations
export {
  contributeKey,
  removeKey,
  removeKeyByAdmin,
  listKeysWithOwnership,
} from "./api-key-ops";

// OAuth operations
export {
  importOAuthCredential,
  listOAuthWithOwnership,
  removeOAuthAccount,
  removeOAuthAccountByIdOrName,
  toggleOAuthAccountByIdOrName,
} from "./oauth-ops";

// Re-export types for consumers that need them
export type {
  ContributeKeyResult,
  RemoveKeyResult,
  ListKeysResult,
  KeyWithOwnership,
  RemoveOAuthResult,
  ListOAuthResult,
  OAuthAccountWithOwnership,
  ImportOAuthResult,
  ToggleOAuthResult,
} from "./management-api";
