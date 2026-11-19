import { normalizeFraction, type QuotaAccount } from "@/lib/model-first-monitoring";
import { capacityQuotaGroups, isShortTermQuotaWindow } from "@/lib/quota-window-classification";
import { headlineQuotaWindows } from "@/lib/quota/headline";

export const AUTO_RESET_COOLDOWN_MS = 10 * 60_000;
const DAY_MS = 86_400_000;

export interface AutoResetRule {
  enabled: boolean;
  fiveHourThresholdPct: number;
  weeklyThresholdPct: number;
  minWeeklyDaysLeft: number;
  lastResetAt?: string | null;
  lastStatus?: string | null;
}

export type AutoResetRulesMap = Record<string, AutoResetRule>;

export interface ResetGrantInfo {
  id: string;
  label: string;
  resetsLeft: number;
  usableNow: boolean;
  program: "cedar_ember" | "juniper_tide";
  expiresAt?: string | null;
}

export interface AutoResetCreditSummary {
  supported: boolean;
  provider: "codex" | "claude" | "unsupported";
  availableCount: number | null;
  grants: ResetGrantInfo[];
  nearestExpiresAt?: string | null;
  error?: string;
}

export interface ExecuteResetResult {
  ok: boolean;
  provider: "codex" | "claude" | "unsupported";
  status: string;
  message: string;
  remainingCredits?: number | null;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

export function normalizeAutoResetRule(input: Partial<AutoResetRule> | null | undefined): AutoResetRule {
  return {
    enabled: input?.enabled === true,
    fiveHourThresholdPct: clampInt(input?.fiveHourThresholdPct, 0, 100, 0),
    weeklyThresholdPct: clampInt(input?.weeklyThresholdPct, 0, 100, 0),
    minWeeklyDaysLeft: clampInt(input?.minWeeklyDaysLeft, 0, 7, 0),
    lastResetAt: typeof input?.lastResetAt === "string" ? input.lastResetAt : null,
    lastStatus: typeof input?.lastStatus === "string" ? input.lastStatus : null,
  };
}

export function normalizeAutoResetProvider(provider: string | undefined | null): "codex" | "claude" | "unsupported" {
  const p = (provider ?? "").trim().toLowerCase();
  if (p === "codex" || p === "openai") return "codex";
  if (p === "claude" || p === "anthropic") return "claude";
  return "unsupported";
}

export function isAutoResetSupportedProvider(provider: string | undefined | null): boolean {
  return normalizeAutoResetProvider(provider) !== "unsupported";
}

export interface AutoResetWindows {
  fiveHourPct: number | null;
  weeklyPct: number | null;
  weeklyDaysLeft?: number | null;
}

export function extractAccountWindowPercentages(
  account: QuotaAccount,
  nowMs = Date.now()
): AutoResetWindows {
  if (!account.groups?.length) {
    return { fiveHourPct: null, weeklyPct: null, weeklyDaysLeft: null };
  }
  const groups = headlineQuotaWindows(capacityQuotaGroups(account.provider, account.groups));
  let fiveHour: number | null = null;
  let weekly: number | null = null;
  let weeklyDaysLeft: number | null = null;

  for (const group of groups) {
    if (group.id === "extra-usage") continue;
    const score = normalizeFraction(group.remainingFraction);
    if (score === null) continue;
    const pct = Math.round(score * 100);
    if (isShortTermQuotaWindow(group, groups)) {
      fiveHour = fiveHour === null ? pct : Math.min(fiveHour, pct);
    } else {
      weekly = weekly === null ? pct : Math.min(weekly, pct);
      if (group.resetTime) {
        const resetMs = Date.parse(group.resetTime);
        if (Number.isFinite(resetMs)) {
          const days = Math.max(0, (resetMs - nowMs) / DAY_MS);
          weeklyDaysLeft = weeklyDaysLeft === null ? days : Math.max(weeklyDaysLeft, days);
        }
      }
    }
  }

  return { fiveHourPct: fiveHour, weeklyPct: weekly, weeklyDaysLeft };
}

export function shouldTriggerAutoReset(
  rule: AutoResetRule,
  windows: AutoResetWindows,
  nowMs = Date.now()
): boolean {
  if (!rule.enabled) return false;
  if (rule.lastResetAt) {
    const lastMs = Date.parse(rule.lastResetAt);
    if (Number.isFinite(lastMs) && nowMs - lastMs < AUTO_RESET_COOLDOWN_MS) {
      return false;
    }
  }
  const { fiveHourPct, weeklyPct, weeklyDaysLeft } = windows;
  if (fiveHourPct === null || weeklyPct === null) return false;
  if (fiveHourPct > rule.fiveHourThresholdPct || weeklyPct > rule.weeklyThresholdPct) return false;
  if (rule.minWeeklyDaysLeft > 0) {
    if (weeklyDaysLeft == null || weeklyDaysLeft < rule.minWeeklyDaysLeft) {
      return false;
    }
  }
  return true;
}
