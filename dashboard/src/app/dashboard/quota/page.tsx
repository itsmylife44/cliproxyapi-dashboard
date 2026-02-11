"use client";

import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface QuotaModel {
  id: string;
  displayName: string;
  remainingFraction: number;
  resetTime: string | null;
}

interface QuotaGroup {
  id: string;
  label: string;
  remainingFraction: number;
  resetTime: string | null;
  models: QuotaModel[];
}

interface QuotaAccount {
  auth_index: string;
  provider: string;
  email: string;
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
} as const;

type ProviderType = (typeof PROVIDERS)[keyof typeof PROVIDERS];

function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (local.length <= 3) return `${local}***@${domain}`;
  return `${local.slice(0, 3)}***@${domain}`;
}

function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return "Unknown";
  
  try {
    const resetDate = new Date(isoDate);
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();
    
    if (diffMs <= 0) return "Resetting...";
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `Resets in ${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `Resets in ${hours}h ${minutes}m`;
    }
    return `Resets in ${minutes}m`;
  } catch {
    return "Unknown";
  }
}

// Classify a group as short-term (≤6h) or long-term based on its id/label
function isShortTermGroup(group: QuotaGroup): boolean {
  const id = group.id.toLowerCase();
  const label = group.label.toLowerCase();
  // Short-term: 5h session, primary window, 5m window, requests, tokens
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

function calcAccountWindowScores(groups: QuotaGroup[]): Record<string, { score: number; label: string; isShortTerm: boolean }> {
  const result: Record<string, { score: number; label: string; isShortTerm: boolean }> = {};
  for (const group of groups) {
    if (group.id === "extra-usage") continue;
    result[group.id] = {
      score: group.remainingFraction,
      label: group.label,
      isShortTerm: isShortTermGroup(group),
    };
  }
  return result;
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
      return group ? group.remainingFraction : 1;
    });

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

function getCapacityBarClass(value: number): string {
  if (value > 0.6) return "bg-emerald-500/80";
  if (value > 0.2) return "bg-amber-500/80";
  return "bg-rose-500/80";
}

export default function QuotaPage() {
  const [quotaData, setQuotaData] = useState<QuotaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>(PROVIDERS.ALL);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchQuota = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/quota");
        if (res.ok) {
          const data = await res.json();
          setQuotaData(data);
        } else {
          console.error("Failed to fetch quota data");
        }
      } catch (error) {
        console.error("Network error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuota();
    const interval = setInterval(fetchQuota, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredAccounts = quotaData?.accounts.filter((account) => {
    if (selectedProvider === PROVIDERS.ALL) return true;
    return account.provider === selectedProvider;
  }) || [];

  const activeAccounts = quotaData?.accounts.filter((account) => account.supported && !account.error).length || 0;

  const providerGroups = new Map<string, QuotaAccount[]>();
  for (const account of quotaData?.accounts ?? []) {
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
  ] as const;

  const toggleCard = (accountId: string) => {
    setExpandedCards((prev) => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  const fetchQuota = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quota");
      if (res.ok) {
        const data = await res.json();
        setQuotaData(data);
      } else {
        console.error("Failed to fetch quota data");
      }
    } catch (error) {
      console.error("Network error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">Quota</h1>
            <p className="mt-1 text-sm text-slate-400">Monitor OAuth account quotas and usage windows.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1">
              {providerFilters.map((filter) => (
                <Button
                  key={filter.key}
                  variant={selectedProvider === filter.key ? "secondary" : "ghost"}
                  onClick={() => setSelectedProvider(filter.key)}
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
        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-6 text-center text-sm text-slate-400">
          Loading quota data...
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Active Accounts</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">{activeAccounts}</p>
            </div>
            <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Overall Capacity</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">{Math.round(overallCapacity.value * 100)}%</p>
            </div>
            <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Low Capacity</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">{lowCapacityCount}</p>
            </div>
            <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Providers</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">{providerSummaries.length}</p>
            </div>
          </section>

          {providerSummaries.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Provider Capacity</h2>
              <div className="overflow-hidden rounded-md border border-slate-700/70 bg-slate-900/25">
                <div className="grid grid-cols-[minmax(0,1fr)_160px_160px_120px_100px] border-b border-slate-700/70 bg-slate-900/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  <span>Provider</span>
                  <span>Long-Term</span>
                  <span>Short-Term</span>
                  <span>Healthy</span>
                  <span>Issues</span>
                </div>
                {providerSummaries.map((summary) => {
                  const longTerm = summary.windowCapacities.filter((w) => !w.isShortTerm);
                  const shortTerm = summary.windowCapacities.filter((w) => w.isShortTerm);
                  const longMin = longTerm.length > 0 ? Math.min(...longTerm.map((w) => w.capacity)) : null;
                  const shortMin = shortTerm.length > 0 ? Math.min(...shortTerm.map((w) => w.capacity)) : null;

                  return (
                    <div key={summary.provider} className="grid grid-cols-[minmax(0,1fr)_160px_160px_120px_100px] items-center border-b border-slate-700/60 px-3 py-2 last:border-b-0">
                      <span className="truncate text-sm font-medium capitalize text-slate-100">{summary.provider}</span>
                      <div className="pr-3">
                        {longMin !== null ? (
                          <>
                            <span className="text-xs text-slate-300">{Math.round(longMin * 100)}%</span>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/70">
                              <div className={cn("h-full", getCapacityBarClass(longMin))} style={{ width: `${Math.round(longMin * 100)}%` }} />
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </div>
                      <div className="pr-3">
                        {shortMin !== null ? (
                          <>
                            <span className="text-xs text-slate-300">{Math.round(shortMin * 100)}%</span>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/70">
                              <div className={cn("h-full", getCapacityBarClass(shortMin))} style={{ width: `${Math.round(shortMin * 100)}%` }} />
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-300">{summary.healthyAccounts}/{summary.totalAccounts}</span>
                      <span className={cn("text-xs", summary.errorAccounts > 0 ? "text-amber-300" : "text-slate-500")}>
                        {summary.errorAccounts > 0 ? summary.errorAccounts : "0"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Accounts</h2>
            <div className="overflow-hidden rounded-md border border-slate-700/70 bg-slate-900/25">
              <div className="grid grid-cols-[24px_minmax(0,1fr)_120px_120px_140px_140px] border-b border-slate-700/70 bg-slate-900/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                <span></span>
                <span>Account</span>
                <span>Provider</span>
                <span>Status</span>
                <span>Long-Term</span>
                <span>Short-Term</span>
              </div>

              {filteredAccounts.map((account) => {
                const isRowExpanded = expandedCards[account.auth_index];
                const scores = account.groups ? Object.values(calcAccountWindowScores(account.groups)) : [];
                const longScores = scores.filter((s) => !s.isShortTerm);
                const shortScores = scores.filter((s) => s.isShortTerm);
                const longMin = longScores.length > 0 ? Math.min(...longScores.map((s) => s.score)) : null;
                const shortMin = shortScores.length > 0 ? Math.min(...shortScores.map((s) => s.score)) : null;
                const statusLabel = account.supported ? (account.error ? "Error" : "Active") : "Unsupported";

                return (
                  <div key={account.auth_index} className="border-b border-slate-700/60 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => toggleCard(account.auth_index)}
                      className="grid w-full grid-cols-[24px_minmax(0,1fr)_120px_120px_140px_140px] items-center px-3 py-2 text-left transition-colors hover:bg-slate-800/40"
                    >
                      <span className={cn("text-xs text-slate-500 transition-transform", isRowExpanded && "rotate-180")}>⌄</span>
                      <span className="truncate text-xs text-slate-200">{maskEmail(account.email)}</span>
                      <span className="truncate text-xs capitalize text-slate-300">{account.provider}</span>
                      <span className={cn("text-xs", account.error ? "text-rose-300" : account.supported ? "text-emerald-300" : "text-amber-300")}>{statusLabel}</span>
                      <div className="pr-3">
                        {longMin !== null ? (
                          <>
                            <span className="text-xs text-slate-300">{Math.round(longMin * 100)}%</span>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/70">
                              <div className={cn("h-full", getCapacityBarClass(longMin))} style={{ width: `${Math.round(longMin * 100)}%` }} />
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </div>
                      <div className="pr-3">
                        {shortMin !== null ? (
                          <>
                            <span className="text-xs text-slate-300">{Math.round(shortMin * 100)}%</span>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/70">
                              <div className={cn("h-full", getCapacityBarClass(shortMin))} style={{ width: `${Math.round(shortMin * 100)}%` }} />
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </div>
                    </button>

                    {isRowExpanded && (
                      <div className="border-t border-slate-700/60 bg-slate-900/30 px-4 py-3">
                        {account.error && (
                          <p className="mb-2 text-xs text-rose-300">{account.error}</p>
                        )}
                        {!account.supported && !account.error && (
                          <p className="mb-2 text-xs text-amber-300">Quota monitoring not available for this provider.</p>
                        )}

                        {account.groups && account.groups.length > 0 && (
                          <div className="overflow-hidden rounded-sm border border-slate-700/70">
                            {account.groups.map((group) => {
                              const pct = Math.round(group.remainingFraction * 100);
                              return (
                                <div key={group.id} className="grid grid-cols-[minmax(0,1fr)_80px_160px] items-center border-b border-slate-700/60 bg-slate-900/20 px-3 py-2 last:border-b-0">
                                  <span className="truncate text-xs text-slate-200">{group.label}</span>
                                  <span className="text-xs text-slate-300">{pct}%</span>
                                  <span className="truncate text-xs text-slate-500">{formatRelativeTime(group.resetTime)}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredAccounts.length === 0 && !loading && (
              <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-6 text-center text-sm text-slate-400">
                No accounts found for the selected filter.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
