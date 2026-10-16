import type { QuotaGroup, QuotaGroupScope } from "@/lib/model-first-monitoring";
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
 * Turns one Codex rate-limit block into quota groups. Secondary limits (additional
 * per-model limits, code review) carry their `scope`, and prefix ids with the scope
 * id and labels with the scope label; the main limit stays unscoped.
 */
function parseCodexRateLimit(
  rateLimit: CodexRateLimitDetails | null | undefined,
  scope?: QuotaGroupScope
): QuotaGroup[] {
  const groups: QuotaGroup[] = [];
  const idPrefix = scope ? `${scope.id}-` : "";
  const labelPrefix = scope ? `${scope.label} ` : "";

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
      ...(scope ? { scope } : {}),
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

const CODE_REVIEW_SCOPE: QuotaGroupScope = { id: "code-review", label: "Code Review" };

/**
 * Scope for one `additional_rate_limits` entry. The id prefers `metered_feature`
 * (stable when the model behind the limit is renamed), then `limit_name`, then the
 * 1-based position; the label prefers the human-readable `limit_name`.
 */
function additionalLimitScope(
  limit: CodexAdditionalRateLimit,
  position: number,
  usedIds: Set<string>
): QuotaGroupScope {
  const meteredFeature = limit.metered_feature?.trim() ?? "";
  const limitName = limit.limit_name?.trim() ?? "";
  const label = limitName || meteredFeature || `Additional Limit ${position}`;
  const baseId = slugifyLabel(meteredFeature) || slugifyLabel(limitName) || `additional-${position}`;

  let id = baseId;
  for (let suffix = position; usedIds.has(id); suffix++) id = `${baseId}-${suffix}`;
  usedIds.add(id);
  return { id, label };
}

export function parseCodexQuota(data: CodexWhamUsageResponse): QuotaGroup[] {
  const groups = parseCodexRateLimit(data.rate_limit);
  const usedScopeIds = new Set<string>([CODE_REVIEW_SCOPE.id]);

  (data.additional_rate_limits ?? []).forEach((limit, index) => {
    if (!limit) return;
    groups.push(...parseCodexRateLimit(limit.rate_limit, additionalLimitScope(limit, index + 1, usedScopeIds)));
  });

  groups.push(...parseCodexRateLimit(data.code_review_rate_limit, CODE_REVIEW_SCOPE));

  return groups;
}
