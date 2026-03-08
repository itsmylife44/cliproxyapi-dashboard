"use client";

import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { HelpTooltip } from "@/components/ui/tooltip";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { QuotaChart } from "@/components/quota/quota-chart";
import { QuotaDetails } from "@/components/quota/quota-details";
import { QuotaAlerts } from "@/components/quota/quota-alerts";

interface QuotaModel {
  id: string;
  displayName: string;
  remainingFraction?: number | null;
  resetTime: string | null;
}

interface QuotaGroup {
  id: string;
  label: string;
  remainingFraction?: number | null;
  resetTime: string | null;
  models: QuotaModel[];
}

interface QuotaAccount {
  auth_index: string;
  provider: string;
  email?: string | null;
  supported: boolean;
  error?: string;
  groups?: QuotaGroup[];
  raw?: unknown;
}

interface QuotaResponse {
  accounts: QuotaAccount[];
}

const PROVIDERS = {
  ALL: "all",
  ANTIGRAVITY: "antigravity",
  CLAUDE: "claude",
  CODEX: "codex",
  COPILOT: "github-copilot",
  KIMI: "kimi",
} as const;

type ProviderType = (typeof PROVIDERS)[keyof typeof PROVIDERS];

function normalizeFraction(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function isShortTermGroup(group: QuotaGroup): boolean {
  const id = group.id.toLowerCase();
  const label = group.label.toLowerCase();
  return (
    id.includes("five-hour") ||
    id.includes("primary") ||
    id.includes("request") ||
    id.includes("token") ||
    label.includes("5h") ||
    label.includes("5m") ||
    label.includes("request") ||
    label.includes("token")
  );
}

interface WindowCapacity {
  id: string;
  label: string;
  capacity: number;
  resetTime: string | null;
  isShortTerm: boolean;
}

interface ProviderSummary {
  provider: string;
  totalAccounts: number;
  healthyAccounts: number;
  errorAccounts: number;
  windowCapacities: WindowCapacity[];
}

function calcProviderSummary(accounts: QuotaAccount[]): ProviderSummary {
  const totalAccounts = accounts.length;
  const healthy = accounts.filter(
    (a) => a.supported && !a.error && a.groups && a.groups.length > 0
  );
  const errorAccounts = totalAccounts - healthy.length;

  const allWindowIds = new Set<string>();
  for (const a of healthy) {
    for (const g of a.groups ?? []) {
      if (g.id !== "extra-usage") allWindowIds.add(g.id);
    }
  }

  const windowCapacities: WindowCapacity[] = [];

  for (const windowId of allWindowIds) {
    const relevantAccounts = healthy.filter((a) =>
      a.groups?.some((g) => g.id === windowId)
    );
    if (relevantAccounts.length === 0) continue;

    const scores = relevantAccounts.map((a) => {
      const group = a.groups?.find((g) => g.id === windowId);
      return normalizeFraction(group?.remainingFraction);
    }).filter((score): score is number => score !== null);

    if (scores.length === 0) {
      continue;
    }

    const exhaustedProduct = scores.reduce((prod, score) => prod * (1 - score), 1);
    const capacity = 1 - exhaustedProduct;

    let earliestReset: string | null = null;
    let minResetTime = Infinity;
    let label = "";
    let isShortTerm = false;

    for (const a of relevantAccounts) {
      const g = a.groups?.find((g) => g.id === windowId);
      if (g) {
        if (!label) {
          label = g.label;
          isShortTerm = isShortTermGroup(g);
        }
        if (g.resetTime) {
          const t = new Date(g.resetTime).getTime();
          if (t < minResetTime) {
            minResetTime = t;
            earliestReset = g.resetTime;
          }
        }
      }
    }

    windowCapacities.push({
      id: windowId,
      label,
      capacity: Math.max(0, Math.min(1, capacity)),
      resetTime: earliestReset,
      isShortTerm,
    });
  }

  windowCapacities.sort((a, b) => {
    if (a.isShortTerm !== b.isShortTerm) return a.isShortTerm ? 1 : -1;
    return a.label.localeCompare(b.label);
  });

  return {
    provider: accounts[0]?.provider ?? "unknown",
    totalAccounts,
    healthyAccounts: healthy.length,
    errorAccounts,
    windowCapacities,
  };
}

function calcOverallCapacity(summaries: ProviderSummary[]): { value: number; label: string; provider: string } {
  if (summaries.length === 0) return { value: 0, label: "No Data", provider: "" };

  let weightedCapacity = 0;
  let weightedAccounts = 0;

  for (const summary of summaries) {
    if (summary.healthyAccounts === 0) {
      continue;
    }

    const longTerm = summary.windowCapacities.filter((w) => !w.isShortTerm);
    const shortTerm = summary.windowCapacities.filter((w) => w.isShortTerm);
    const relevantWindows = longTerm.length > 0 ? longTerm : shortTerm;

    if (relevantWindows.length === 0) {
      continue;
    }

    const providerCapacity = Math.min(...relevantWindows.map((w) => w.capacity));
    weightedCapacity += providerCapacity * summary.healthyAccounts;
    weightedAccounts += summary.healthyAccounts;
  }

  if (weightedAccounts === 0) {
    return { value: 0, label: "No Data", provider: "" };
  }

  return {
    value: weightedCapacity / weightedAccounts,
    label: "Weighted capacity",
    provider: "all",
  };
}

export default function QuotaPage() {
  const [quotaData, setQuotaData] = useState<QuotaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>(PROVIDERS.ALL);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const fetchQuota = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.QUOTA.BASE, { signal });
      if (res.ok) {
        const data = await res.json();
        setQuotaData(data);
      }
    } catch {
      if (signal?.aborted) return;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchQuota(controller.signal);
    const interval = setInterval(() => fetchQuota(controller.signal), 120_000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  const filteredAccounts = quotaData?.accounts.filter((account) => {
    if (selectedProvider === PROVIDERS.ALL) return true;
    if (selectedProvider === PROVIDERS.COPILOT) {
      return account.provider === "github" || account.provider === "github-copilot";
    }
    return account.provider === selectedProvider;
  }) || [];

  const activeAccounts = filteredAccounts.filter((account) => account.supported && !account.error).length;

  const providerGroups = new Map<string, QuotaAccount[]>();
  for (const account of filteredAccounts) {
    const existing = providerGroups.get(account.provider) ?? [];
    existing.push(account);
    providerGroups.set(account.provider, existing);
  }

  const providerSummaries = Array.from(providerGroups.entries())
    .map(([, accounts]) => calcProviderSummary(accounts))
    .sort((a, b) => b.healthyAccounts - a.healthyAccounts);

  const overallCapacity = calcOverallCapacity(providerSummaries);

  const lowCapacityCount = providerSummaries.filter(
    (s) => s.windowCapacities.some((w) => w.capacity < 0.2) && s.totalAccounts > 0
  ).length;

  const providerFilters = [
    { key: PROVIDERS.ALL, label: "All" },
    { key: PROVIDERS.ANTIGRAVITY, label: "Antigravity" },
    { key: PROVIDERS.CLAUDE, label: "Claude" },
    { key: PROVIDERS.CODEX, label: "Codex" },
    { key: PROVIDERS.COPILOT, label: "Copilot" },
    { key: PROVIDERS.KIMI, label: "Kimi" },
  ] as const;

  const toggleCard = (accountId: string) => {
    setExpandedCards((prev) => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">Quota</h1>
            <p className="mt-1 text-sm text-slate-400">Monitor OAuth account quotas and usage windows.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap gap-1">
              {providerFilters.map((filter) => (
                <Button
                  key={filter.key}
                  variant={selectedProvider === filter.key ? "secondary" : "ghost"}
                  onClick={() => {
                    setSelectedProvider(filter.key);
                    if (filter.key !== PROVIDERS.ALL) {
                      setTimeout(() => {
                        document.getElementById("quota-accounts")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }, 50);
                    }
                  }}
                  className="px-2.5 py-1 text-xs"
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <Button onClick={fetchQuota} disabled={loading} className="px-2.5 py-1 text-xs">
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </div>
      </section>

      {loading && !quotaData ? (
        <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
          Loading quota data...
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Active Accounts</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">{activeAccounts}</p>
            </div>
            <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Overall Capacity <HelpTooltip content="Weighted average of remaining quota across all active provider accounts" /></p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">{Math.round(overallCapacity.value * 100)}%</p>
            </div>
            <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Low Capacity <HelpTooltip content="Number of accounts with remaining quota below 20%" /></p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">{lowCapacityCount}</p>
            </div>
            <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Providers</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">{providerSummaries.length}</p>
            </div>
          </section>

          <QuotaChart overallCapacity={overallCapacity} providerSummaries={providerSummaries} />

          <QuotaDetails
            filteredAccounts={filteredAccounts}
            expandedCards={expandedCards}
            onToggleCard={toggleCard}
            loading={loading}
          />
        </>
      )}

      <QuotaAlerts />
    </div>
  );
}
