import { normalizeFraction, type QuotaAccount } from "@/lib/model-first-monitoring";
import { capacityQuotaGroups, isShortTermQuotaWindow } from "@/lib/quota-window-classification";
import { headlineQuotaWindows } from "@/lib/quota/headline";

export const AUTO_RESET_COOLDOWN_MS = 10 * 60_000;

export interface AutoResetRule {
  enabled: boolean;
  fiveHourThresholdPct: number;
  weeklyThresholdPct: number;
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
}

export interface AutoResetCreditSummary {
  supported: boolean;
  provider: "codex" | "claude" | "unsupported";
  availableCount: number | null;
  grants: ResetGrantInfo[];
  error?: string;
}

export interface ExecuteResetResult {
  ok: boolean;
  provider: "codex" | "claude" | "unsupported";
  status: string;
  message: string;
  remainingCredits?: number | null;
}

function clampPct(value: unknown, fallback = 0): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

export function normalizeAutoResetRule(input: Partial<AutoResetRule> | null | undefined): AutoResetRule {
  return {
    enabled: input?.enabled === true,
    fiveHourThresholdPct: clampPct(input?.fiveHourThresholdPct, 0),
    weeklyThresholdPct: clampPct(input?.weeklyThresholdPct, 0),
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

export function extractAccountWindowPercentages(account: QuotaAccount): {
  fiveHourPct: number | null;
  weeklyPct: number | null;
} {
  if (!account.groups?.length) return { fiveHourPct: null, weeklyPct: null };
  const groups = headlineQuotaWindows(capacityQuotaGroups(account.provider, account.groups));
  let fiveHour: number | null = null;
  let weekly: number | null = null;

  for (const group of groups) {
    if (group.id === "extra-usage") continue;
    const score = group.severity === "critical" ? 0 : normalizeFraction(group.remainingFraction);
    if (score === null) continue;
    const pct = Math.round(score * 100);
    if (isShortTermQuotaWindow(group, groups)) {
      fiveHour = fiveHour === null ? pct : Math.min(fiveHour, pct);
    } else {
      weekly = weekly === null ? pct : Math.min(weekly, pct);
    }
  }

  return { fiveHourPct: fiveHour, weeklyPct: weekly };
}

export function shouldTriggerAutoReset(
  rule: AutoResetRule,
  windows: { fiveHourPct: number | null; weeklyPct: number | null },
  nowMs = Date.now()
): boolean {
  if (!rule.enabled) return false;
  if (rule.lastResetAt) {
    const lastMs = Date.parse(rule.lastResetAt);
    if (Number.isFinite(lastMs) && nowMs - lastMs < AUTO_RESET_COOLDOWN_MS) {
      return false;
    }
  }
  const { fiveHourPct, weeklyPct } = windows;
  if (fiveHourPct === null && weeklyPct === null) return false;
  if (fiveHourPct !== null && fiveHourPct > rule.fiveHourThresholdPct) return false;
  if (weeklyPct !== null && weeklyPct > rule.weeklyThresholdPct) return false;
  return true;
}
