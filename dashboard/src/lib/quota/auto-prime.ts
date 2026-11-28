import { logger } from "@/lib/logger";
import { getManagementUrl, getProxyBaseUrl } from "@/lib/management-url";
import { normalizeFraction, type QuotaAccount, type QuotaGroup } from "@/lib/model-first-monitoring";
import { resolveModelPrice } from "@/lib/model-pricing";
import { getLiveModelPricing } from "@/lib/model-pricing-catalog";
import { bustQuotaCaches, fetchAuthFilesMeta, loadAutoResetRules, recordQuotaResetEvent } from "@/lib/quota/auto-reset";
import { headlineQuotaWindows } from "@/lib/quota/headline";
import { snapshotKey, type PreviousSnapshots } from "@/lib/quota/quota-snapshots";

const FULL_EPSILON = 1e-9;

/**
 * A window needs priming when it is still full and has not started: either it reports
 * no reset time, or the reset time stored before this pass has already passed. A window
 * below 100% has been used, so it is already running; after a prime the stored reset time
 * lies in the future, so the same window is not primed twice.
 */
function needsPrime(authIndex: string, group: QuotaGroup, previous: PreviousSnapshots, nowMs: number): boolean {
  const remaining = normalizeFraction(group.remainingFraction);
  if (remaining === null || remaining < 1 - FULL_EPSILON) return false;
  if (!group.resetTime) return true;
  const stored = previous.get(snapshotKey(authIndex, group.id, group.models[0]?.id ?? ""));
  return Boolean(stored?.resetTime && stored.resetTime.getTime() <= nowMs);
}

async function cheapestModel(authFileName: string): Promise<string | undefined> {
  const res = await fetch(`${getManagementUrl()}/auth-files/models?name=${encodeURIComponent(authFileName)}`, {
    headers: { Authorization: `Bearer ${process.env.MANAGEMENT_API_KEY}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return undefined;
  const { models = [] } = (await res.json()) as { models?: Array<{ id: string }> };
  const livePricing = await getLiveModelPricing();
  let best: { id: string; cost: number } | undefined;
  for (const { id } of models) {
    const price = resolveModelPrice(id, undefined, livePricing);
    const cost = price ? price.inputPer1M + price.outputPer1M : Infinity;
    if (!best || cost < best.cost) best = { id, cost };
  }
  return best?.id;
}

/** Sends the smallest account-pinned request the proxy supports, which starts every idle window. */
async function primeAccount(authIndex: string, model: string | undefined): Promise<boolean> {
  const res = await fetch(`${getProxyBaseUrl()}/v8/management/credentials/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.MANAGEMENT_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ auth_index: authIndex, ...(model ? { model } : {}) }),
    signal: AbortSignal.timeout(60_000),
  });
  if (res.ok) {
    await res.body?.cancel().catch(() => undefined);
    return true;
  }
  logger.warn({ authIndex, model, status: res.status, body: (await res.text()).slice(0, 300) }, "Quota window prime rejected by proxy");
  return false;
}

export async function primeIdleWindows(
  accounts: QuotaAccount[],
  previous: PreviousSnapshots,
  nowMs = Date.now()
): Promise<number> {
  const rules = await loadAutoResetRules();
  const due = accounts.filter((account) =>
    rules[account.auth_index]?.prime &&
    account.supported &&
    !account.error &&
    headlineQuotaWindows(account.groups ?? []).some((group) => needsPrime(account.auth_index, group, previous, nowMs))
  );
  if (due.length === 0) return 0;

  const files = new Map((await fetchAuthFilesMeta()).map((file) => [String(file.auth_index), file]));
  let primed = 0;
  for (const account of due) {
    const file = files.get(account.auth_index);
    if (!file?.name || file.disabled) continue;
    try {
      if (!(await primeAccount(account.auth_index, await cheapestModel(file.name)))) continue;
      bustQuotaCaches(account.auth_index);
      await recordQuotaResetEvent(account.auth_index, "prime");
      primed++;
    } catch (error) {
      logger.warn({ error, authIndex: account.auth_index }, "Failed to prime quota windows");
    }
  }
  return primed;
}
