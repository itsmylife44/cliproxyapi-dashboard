import type { QuotaGroupScope } from "@/lib/model-first-monitoring";

/**
 * Windows that count toward an account's or provider's headline capacity: the main
 * (unscoped) windows. Scoped limits such as a Codex per-model or code review limit
 * are still listed on their own, but an exhausted one must not show the whole account
 * as empty. Falls back to every window when nothing is unscoped, so an account that
 * only reports scoped limits still gets a headline.
 */
export function headlineQuotaWindows<T extends { scope?: QuotaGroupScope }>(windows: readonly T[]): T[] {
  const unscoped = windows.filter((window) => !window.scope);
  return unscoped.length > 0 ? unscoped : [...windows];
}
