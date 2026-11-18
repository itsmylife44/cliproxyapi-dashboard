import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { CACHE_KEYS, quotaCache, quotaAccountCache } from "@/lib/cache";
import { getManagementUrl } from "@/lib/management-url";
import type { QuotaAccount } from "@/lib/model-first-monitoring";
import {
  extractAccountWindowPercentages,
  isAutoResetSupportedProvider,
  normalizeAutoResetProvider,
  normalizeAutoResetRule,
  shouldTriggerAutoReset,
  type AutoResetCreditSummary,
  type AutoResetRule,
  type AutoResetRulesMap,
  type ExecuteResetResult,
  type ResetGrantInfo,
} from "@/lib/quota/auto-reset-rules";

export {
  extractAccountWindowPercentages,
  isAutoResetSupportedProvider,
  normalizeAutoResetProvider,
  normalizeAutoResetRule,
  shouldTriggerAutoReset,
  type AutoResetCreditSummary,
  type AutoResetRule,
  type AutoResetRulesMap,
  type ExecuteResetResult,
  type ResetGrantInfo,
};

export const AUTO_RESET_SETTING_KEY = "quota_auto_reset_rules";

const CODEX_RESET_CREDITS_URL = "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";
const CODEX_CONSUME_RESET_URL = "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits/consume";
const CODEX_USER_AGENT = "codex-tui/0.135.0 (Linux 6.8.0; x86_64) xterm-256color";

const CLAUDE_PROFILE_URL = "https://api.anthropic.com/api/oauth/profile";
const CLAUDE_RESET_USAGE_URL =
  "https://api.anthropic.com/api/oauth/usage?at_wall=1&cedar_ember=1&skip_spend=1";
const CLAUDE_CLI_USER_AGENT = "claude-cli/2.1.301 (external, cli)";

interface AuthFileMeta {
  auth_index: string | number;
  provider?: string;
  id?: string;
  name?: string;
  path?: string;
  label?: string;
  disabled?: boolean;
  status?: string;
  id_token?: { chatgpt_account_id?: string };
}

interface ManagementApiCallResponse {
  status_code?: number;
  statusCode?: number;
  body?: unknown;
}

export async function loadAutoResetRules(): Promise<AutoResetRulesMap> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: AUTO_RESET_SETTING_KEY },
    });
    if (!row?.value) return {};
    const parsed = JSON.parse(row.value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const clean: AutoResetRulesMap = {};
    for (const [authIndex, rawRule] of Object.entries(parsed)) {
      if (!authIndex || !rawRule || typeof rawRule !== "object") continue;
      clean[authIndex] = normalizeAutoResetRule(rawRule as Partial<AutoResetRule>);
    }
    return clean;
  } catch (err) {
    logger.warn({ err }, "Failed to load quota auto-reset rules");
    return {};
  }
}

export async function saveAutoResetRules(rules: AutoResetRulesMap): Promise<AutoResetRulesMap> {
  await prisma.systemSetting.upsert({
    where: { key: AUTO_RESET_SETTING_KEY },
    create: { key: AUTO_RESET_SETTING_KEY, value: JSON.stringify(rules) },
    update: { value: JSON.stringify(rules) },
  });
  return rules;
}

export async function upsertAutoResetRule(
  authIndex: string,
  patch: Partial<AutoResetRule>
): Promise<{ rules: AutoResetRulesMap; rule: AutoResetRule }> {
  const rules = await loadAutoResetRules();
  const prev = rules[authIndex];
  const next = normalizeAutoResetRule({
    enabled: patch.enabled ?? prev?.enabled ?? false,
    fiveHourThresholdPct: patch.fiveHourThresholdPct ?? prev?.fiveHourThresholdPct ?? 0,
    weeklyThresholdPct: patch.weeklyThresholdPct ?? prev?.weeklyThresholdPct ?? 0,
    minWeeklyDaysLeft: patch.minWeeklyDaysLeft ?? prev?.minWeeklyDaysLeft ?? 0,
    lastResetAt: patch.lastResetAt !== undefined ? patch.lastResetAt : prev?.lastResetAt ?? null,
    lastStatus: patch.lastStatus !== undefined ? patch.lastStatus : prev?.lastStatus ?? null,
  });
  rules[authIndex] = next;
  await saveAutoResetRules(rules);
  return { rules, rule: next };
}

function parseJsonBody(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw ?? null;
}

async function callUpstreamViaManagement(payload: {
  auth_index: string;
  method: "GET" | "POST";
  url: string;
  header: Record<string, string>;
  data?: string;
}): Promise<{ ok: boolean; status: number; body: unknown; rawText?: string }> {
  const managementKey = process.env.MANAGEMENT_API_KEY;
  if (!managementKey) {
    return { ok: false, status: 500, body: null, rawText: "MANAGEMENT_API_KEY not configured" };
  }

  const res = await fetch(`${getManagementUrl()}/api-call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${managementKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, body: null, rawText: text || `HTTP ${res.status}` };
  }

  const apiCallResult = (await res.json()) as ManagementApiCallResponse;
  const upstreamStatus = Number(apiCallResult.status_code ?? apiCallResult.statusCode ?? res.status);
  const parsedBody = parseJsonBody(apiCallResult.body);
  return {
    ok: upstreamStatus >= 200 && upstreamStatus < 300,
    status: upstreamStatus,
    body: parsedBody,
    rawText: typeof apiCallResult.body === "string" ? apiCallResult.body : undefined,
  };
}

function extractCodexCreditCount(body: unknown): number {
  if (!body || typeof body !== "object") return 0;
  const record = body as Record<string, unknown>;
  for (const key of ["available_credits", "credit_count", "remaining_credits", "count", "credits_remaining"]) {
    const val = record[key];
    if (typeof val === "number" && Number.isFinite(val)) return Math.max(0, Math.floor(val));
  }
  const nested = record.reset_credits ?? record.credits;
  if (typeof nested === "number" && Number.isFinite(nested)) return Math.max(0, Math.floor(nested));
  if (Array.isArray(nested)) return nested.length;
  if (nested && typeof nested === "object") {
    const n = nested as Record<string, unknown>;
    if (typeof n.count === "number" && Number.isFinite(n.count)) return Math.max(0, Math.floor(n.count));
    if (typeof n.available === "number" && Number.isFinite(n.available)) return Math.max(0, Math.floor(n.available));
  }
  if (typeof record.credit_balance === "number" && Number.isFinite(record.credit_balance)) {
    return Math.max(0, Math.floor(record.credit_balance));
  }
  return 0;
}

function codexHeaders(accountId?: string): Record<string, string> {
  return {
    Authorization: "Bearer $TOKEN$",
    Accept: "application/json",
    "User-Agent": CODEX_USER_AGENT,
    Originator: "codex-tui",
    ...(accountId ? { "Chatgpt-Account-Id": accountId } : {}),
  };
}

function claudeCliHeaders(): Record<string, string> {
  return {
    Authorization: "Bearer $TOKEN$",
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "User-Agent": CLAUDE_CLI_USER_AGENT,
    "x-app": "cli",
    "anthropic-beta": "oauth-2025-04-20",
  };
}

function parseClaudeGrantsFromUsage(usageBody: unknown): ResetGrantInfo[] {
  if (!usageBody || typeof usageBody !== "object") return [];
  const root = usageBody as Record<string, unknown>;
  const grants: ResetGrantInfo[] = [];

  const cedar = root.cedar_ember as Record<string, unknown> | undefined;
  if (cedar && Array.isArray(cedar.grants)) {
    for (const raw of cedar.grants) {
      if (!raw || typeof raw !== "object") continue;
      const g = raw as Record<string, unknown>;
      const id = typeof g.id === "string" ? g.id.trim() : "";
      const resetsLeft = typeof g.resets_left === "number" ? g.resets_left : 0;
      if (!id || resetsLeft <= 0 || g.paused === true) continue;
      const clears = Array.isArray(g.clears)
        ? g.clears.filter((c): c is string => typeof c === "string")
        : [];
      grants.push({
        id,
        label:
          typeof g.label === "string" && g.label.trim()
            ? g.label
            : clears.length > 0
              ? `Grant (${clears.join(", ")})`
              : "Banked Reset Grant",
        resetsLeft,
        usableNow: g.usable_now === true,
        program: "cedar_ember",
      });
    }
  }

  const juniper = root.juniper_tide as Record<string, unknown> | undefined;
  if (juniper && juniper.eligible === true && juniper.arm === "reset" && juniper.available === true) {
    grants.push({
      id: "juniper_tide",
      label: "Weekly 5h Session Reset",
      resetsLeft: 1,
      usableNow: true,
      program: "juniper_tide",
    });
  }

  return grants;
}

async function resolveClaudeOrganizationUuid(authIndex: string): Promise<string | null> {
  const profileRes = await callUpstreamViaManagement({
    auth_index: authIndex,
    method: "GET",
    url: CLAUDE_PROFILE_URL,
    header: claudeCliHeaders(),
  });
  if (!profileRes.ok || !profileRes.body || typeof profileRes.body !== "object") return null;
  const org = (profileRes.body as Record<string, unknown>).organization;
  if (!org || typeof org !== "object") return null;
  const uuid = (org as Record<string, unknown>).uuid;
  return typeof uuid === "string" && uuid.trim() ? uuid.trim() : null;
}

export async function inspectAccountResetCredits(params: {
  auth_index: string;
  provider: string;
  accountId?: string;
}): Promise<AutoResetCreditSummary> {
  const providerKind = normalizeAutoResetProvider(params.provider);
  if (providerKind === "unsupported") {
    return { supported: false, provider: "unsupported", availableCount: null, grants: [] };
  }

  if (providerKind === "codex") {
    const res = await callUpstreamViaManagement({
      auth_index: params.auth_index,
      method: "GET",
      url: CODEX_RESET_CREDITS_URL,
      header: codexHeaders(params.accountId),
    });
    if (!res.ok) {
      return {
        supported: true,
        provider: "codex",
        availableCount: null,
        grants: [],
        error: `Codex reset credits check failed (${res.status})`,
      };
    }
    const count = extractCodexCreditCount(res.body);
    return {
      supported: true,
      provider: "codex",
      availableCount: count,
      grants:
        count > 0
          ? [{ id: "codex_banked", label: "Banked Codex Reset Credit", resetsLeft: count, usableNow: true, program: "cedar_ember" }]
          : [],
    };
  }

  const res = await callUpstreamViaManagement({
    auth_index: params.auth_index,
    method: "GET",
    url: CLAUDE_RESET_USAGE_URL,
    header: claudeCliHeaders(),
  });
  if (!res.ok) {
    return {
      supported: true,
      provider: "claude",
      availableCount: null,
      grants: [],
      error: `Claude reset eligibility check failed (${res.status})`,
    };
  }
  const grants = parseClaudeGrantsFromUsage(res.body);
  const availableCount = grants.reduce((sum, g) => sum + (g.usableNow ? g.resetsLeft : 0), 0);
  return {
    supported: true,
    provider: "claude",
    availableCount,
    grants,
  };
}

function bustQuotaCaches(authIndex: string): void {
  quotaCache.invalidate("quota:all");
  quotaCache.invalidate("quota:previous");
  const escapedPrefix = CACHE_KEYS.quotaAccount(authIndex).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  quotaAccountCache.invalidatePattern(new RegExp(`^${escapedPrefix}:`));
}

export async function executeAccountReset(params: {
  auth_index: string;
  provider: string;
  accountId?: string;
}): Promise<ExecuteResetResult> {
  const providerKind = normalizeAutoResetProvider(params.provider);
  if (providerKind === "unsupported") {
    return {
      ok: false,
      provider: "unsupported",
      status: "unsupported",
      message: "Usage reset is only supported for Codex and Claude accounts",
    };
  }

  if (providerKind === "codex") {
    const consumeRes = await callUpstreamViaManagement({
      auth_index: params.auth_index,
      method: "POST",
      url: CODEX_CONSUME_RESET_URL,
      header: {
        ...codexHeaders(params.accountId),
        "Content-Type": "application/json",
      },
      data: JSON.stringify({ redeem_request_id: randomUUID() }),
    });

    if (!consumeRes.ok) {
      return {
        ok: false,
        provider: "codex",
        status: `http_${consumeRes.status}`,
        message: `Codex reset request failed (HTTP ${consumeRes.status})`,
      };
    }

    bustQuotaCaches(params.auth_index);
    const body = consumeRes.body as Record<string, unknown> | null;
    const remaining =
      body && typeof body.available_credits === "number"
        ? body.available_credits
        : body && typeof body.remaining_credits === "number"
          ? body.remaining_credits
          : null;

    return {
      ok: true,
      provider: "codex",
      status: "reset",
      message: "Codex usage quota reset redeemed",
      remainingCredits: remaining,
    };
  }

  // Claude path: check grants + juniper_tide, resolve organization UUID, then POST reset_rate_limits
  const credits = await inspectAccountResetCredits(params);
  if (credits.error) {
    return {
      ok: false,
      provider: "claude",
      status: "check_failed",
      message: credits.error,
    };
  }

  const usableCedarGrant = credits.grants.find((g) => g.program === "cedar_ember" && g.usableNow);
  const juniperGrant = credits.grants.find((g) => g.program === "juniper_tide" && g.usableNow);
  const selected = usableCedarGrant ?? juniperGrant;

  if (!selected) {
    return {
      ok: false,
      provider: "claude",
      status: "unavailable",
      message: "No eligible Claude reset credit or weekly session reset currently available",
      remainingCredits: 0,
    };
  }

  const orgUuid = await resolveClaudeOrganizationUuid(params.auth_index);
  if (!orgUuid) {
    return {
      ok: false,
      provider: "claude",
      status: "no_organization",
      message: "Could not resolve Claude organization UUID from OAuth profile",
    };
  }

  const bodyPayload =
    selected.program === "cedar_ember"
      ? { program: "cedar_ember", grant_id: selected.id, request_id: randomUUID() }
      : { program: "juniper_tide" };

  const claimRes = await callUpstreamViaManagement({
    auth_index: params.auth_index,
    method: "POST",
    url: `https://api.anthropic.com/api/organizations/${encodeURIComponent(orgUuid)}/reset_rate_limits`,
    header: claudeCliHeaders(),
    data: JSON.stringify(bodyPayload),
  });

  const parsed = (claimRes.body ?? {}) as Record<string, unknown>;
  const resultCode = typeof parsed.result === "string" ? parsed.result : claimRes.ok ? "reset" : `http_${claimRes.status}`;
  const ok = claimRes.ok && (resultCode === "reset" || resultCode === "not_limited");
  if (ok) {
    bustQuotaCaches(params.auth_index);
  }

  return {
    ok,
    provider: "claude",
    status: resultCode,
    message: ok
      ? `Claude ${selected.program === "cedar_ember" ? "grant" : "session"} reset applied (${resultCode})`
      : `Claude reset returned: ${resultCode}`,
    remainingCredits: typeof parsed.resets_left === "number" ? parsed.resets_left : null,
  };
}

async function fetchAuthFilesMeta(): Promise<AuthFileMeta[]> {
  const managementKey = process.env.MANAGEMENT_API_KEY;
  if (!managementKey) return [];
  const res = await fetch(`${getManagementUrl()}/auth-files`, {
    headers: { Authorization: `Bearer ${managementKey}` },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res?.ok) return [];
  const data = (await res.json()) as { files?: AuthFileMeta[] };
  return data.files ?? [];
}

export async function resolveAuthMetaByIndex(authIndex: string): Promise<AuthFileMeta | null> {
  const files = await fetchAuthFilesMeta();
  return files.find((f) => String(f.auth_index) === authIndex) ?? null;
}

export async function evaluateAutoResetsForAccounts(accounts: QuotaAccount[]): Promise<number> {
  const rules = await loadAutoResetRules();
  if (!Object.values(rules).some((rule) => rule.enabled)) return 0;

  let triggered = 0;
  let dirty = false;
  let authMetaMap: Map<string, AuthFileMeta> | null = null;

  for (const account of accounts) {
    const rule = rules[account.auth_index];
    if (!rule?.enabled || !isAutoResetSupportedProvider(account.provider)) continue;

    const windows = extractAccountWindowPercentages(account);
    if (!shouldTriggerAutoReset(rule, windows)) continue;

    if (!authMetaMap) {
      const files = await fetchAuthFilesMeta();
      authMetaMap = new Map(files.map((f) => [String(f.auth_index), f]));
    }

    const meta = authMetaMap.get(account.auth_index);
    const result = await executeAccountReset({
      auth_index: account.auth_index,
      provider: account.provider,
      accountId: meta?.id_token?.chatgpt_account_id,
    });

    rules[account.auth_index] = {
      ...rule,
      lastResetAt: new Date().toISOString(),
      lastStatus: result.ok ? "reset" : result.status,
    };
    dirty = true;

    if (result.ok) {
      triggered++;
      logger.info({ authIndex: account.auth_index, provider: account.provider }, "Auto-reset executed");
    } else {
      logger.info(
        { authIndex: account.auth_index, provider: account.provider, status: result.status },
        "Auto-reset skipped or unavailable"
      );
    }
  }

  if (dirty) {
    await saveAutoResetRules(rules);
  }
  return triggered;
}
