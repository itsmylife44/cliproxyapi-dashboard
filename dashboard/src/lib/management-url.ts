// Kept out of env.ts so callers (scripts, tests that stub process.env) can read
// the management URL without validating the whole environment at import time.
export const DEFAULT_MANAGEMENT_URL = "http://cliproxyapi:8317/v0/management";

export function getManagementUrl(): string {
  return process.env.CLIPROXYAPI_MANAGEMENT_URL || DEFAULT_MANAGEMENT_URL;
}

/** CLIProxyAPI base URL: the management URL minus its `/v<N>/management` suffix. */
export function getProxyBaseUrl(managementUrl: string = getManagementUrl()): string {
  return managementUrl.replace(/\/v\d+\/management\/?$/, "");
}
