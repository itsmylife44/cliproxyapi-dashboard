// Kept out of env.ts so callers (scripts, tests that stub process.env) can read
// the management URL without validating the whole environment at import time.
export const DEFAULT_MANAGEMENT_URL = "http://cliproxyapi:8317/v0/management";

/** CLIPROXYAPI_MANAGEMENT_URL as configured (trimmed), or undefined when unset or blank. */
export function getConfiguredManagementUrl(): string | undefined {
  return process.env.CLIPROXYAPI_MANAGEMENT_URL?.trim() || undefined;
}

export function getManagementUrl(): string {
  return getConfiguredManagementUrl() ?? DEFAULT_MANAGEMENT_URL;
}

/** CLIProxyAPI base URL: the management URL minus its `/v<N>/management` suffix. */
export function getProxyBaseUrl(managementUrl: string = getManagementUrl()): string {
  return managementUrl.replace(/\/v\d+\/management\/?$/, "");
}
