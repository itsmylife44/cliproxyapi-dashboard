import type { QuotaGroup } from "@/lib/model-first-monitoring";
import { formatWindowLabel, slugifyLabel } from "@/lib/quota/labels";

// Payload shapes of chatgpt.com `/backend-api/wham/usage` (mirrors openai/codex).
interface CodexRateWindow {
  limit_window_seconds?: number | string | null;
  used_percent?: number;
  reset_at?: number;
}

interface CodexRateLimitDetails {
  primary_window?: CodexRateWindow | null;
  secondary_window?: CodexRateWindow | null;
}

// Mirrors openai/codex `AdditionalRateLimitDetails` (e.g. per-model weekly limits).
interface CodexAdditionalRateLimit {
  limit_name?: string | null;
  metered_feature?: string | null;
  rate_limit?: CodexRateLimitDetails | null;
}

export interface CodexWhamUsageResponse {
  rate_limit?: CodexRateLimitDetails | null;
  additional_rate_limits?: CodexAdditionalRateLimit[] | null;
  code_review_rate_limit?: CodexRateLimitDetails | null;
  plan_type?: string;
}

/**
 * Turns one Codex rate-limit block into quota groups. Scoped limits (additional
 * per-model limits, code review) prefix ids with `<scope>-` and labels with their
 * name; the `-primary-window`/`-secondary-window` id suffix is shared with the main
 * limit so provider pooling can tell scopes apart (see provider-summary).
 */
function parseCodexRateLimit(
  rateLimit: CodexRateLimitDetails | null | undefined,
  scope?: { id: string; name: string }
): QuotaGroup[] {
  const groups: QuotaGroup[] = [];
  const idPrefix = scope ? `${scope.id}-` : "";
  const labelPrefix = scope ? `${scope.name} ` : "";

  const windows: Array<{ key: string; window: CodexRateWindow | null | undefined }> = [
    { key: "primary", window: rateLimit?.primary_window },
    { key: "secondary", window: rateLimit?.secondary_window },
  ];

  for (const { key, window } of windows) {
    if (!window || typeof window.used_percent !== "number") continue;

    const remainingFraction = Math.max(0, Math.min(1, 1 - window.used_percent / 100));
    const resetTime = window.reset_at
      ? new Date(window.reset_at * 1000).toISOString()
      : null;
    // Normalize once so the label and the capacity classifier always agree on the duration.
    const parsedWindowSeconds = Number(window.limit_window_seconds);
    const windowSeconds = Number.isFinite(parsedWindowSeconds) && parsedWindowSeconds > 0
      ? parsedWindowSeconds
      : undefined;
    const label = labelPrefix + (windowSeconds
      ? formatWindowLabel(windowSeconds)
      : `${key.charAt(0).toUpperCase() + key.slice(1)} Window`);
    const id = `${idPrefix}${key}-window`;

    groups.push({
      id,
      label,
      windowSeconds,
      remainingFraction,
      resetTime,
      models: [
        {
          id,
          displayName: label,
          remainingFraction,
          resetTime,
        },
      ],
    });
  }

  return groups;
}

export function parseCodexQuota(data: CodexWhamUsageResponse): QuotaGroup[] {
  const groups = parseCodexRateLimit(data.rate_limit);
  const usedScopeIds = new Set<string>(["code-review"]);

  (data.additional_rate_limits ?? []).forEach((limit, index) => {
    if (!limit) return;
    const name = limit.limit_name?.trim() || limit.metered_feature?.trim() || `Additional Limit ${index + 1}`;
    let scopeId = slugifyLabel(name) || `additional-${index + 1}`;
    if (usedScopeIds.has(scopeId)) scopeId = `${scopeId}-${index + 1}`;
    usedScopeIds.add(scopeId);
    groups.push(...parseCodexRateLimit(limit.rate_limit, { id: scopeId, name }));
  });

  groups.push(...parseCodexRateLimit(data.code_review_rate_limit, { id: "code-review", name: "Code Review" }));

  return groups;
}
