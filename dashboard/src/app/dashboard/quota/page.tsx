"use client";

import { Card, CardContent } from "@/components/ui/card";
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

function getProgressColor(fraction: number): string {
  if (fraction > 0.6) return "bg-emerald-500";
  if (fraction > 0.2) return "bg-amber-500";
  return "bg-red-500";
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
  let minCap = 1;
  let minLabel = "";
  let minProvider = "";
  let foundLongTerm = false;

  for (const s of summaries) {
    for (const w of s.windowCapacities) {
      if (!w.isShortTerm) {
        if (!foundLongTerm || w.capacity < minCap) {
          minCap = w.capacity;
          minLabel = w.label;
          minProvider = s.provider;
          foundLongTerm = true;
        }
      }
    }
  }

  if (!foundLongTerm) {
    for (const s of summaries) {
      for (const w of s.windowCapacities) {
        if (w.capacity < minCap) {
          minCap = w.capacity;
          minLabel = w.label;
          minProvider = s.provider;
        }
      }
    }
  }

  if (summaries.length === 0) return { value: 0, label: "No Data", provider: "" };
  return { value: minCap, label: minLabel, provider: minProvider };
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg">
            Quota
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Monitor OAuth account quotas and usage limits
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1.5">
            <Button
              variant={selectedProvider === PROVIDERS.ALL ? "secondary" : "ghost"}
              onClick={() => setSelectedProvider(PROVIDERS.ALL)}
              className="text-xs px-3 py-1.5"
            >
              All
            </Button>
            <Button
              variant={selectedProvider === PROVIDERS.ANTIGRAVITY ? "secondary" : "ghost"}
              onClick={() => setSelectedProvider(PROVIDERS.ANTIGRAVITY)}
              className="text-xs px-3 py-1.5"
            >
              Antigravity
            </Button>
            <Button
              variant={selectedProvider === PROVIDERS.CLAUDE ? "secondary" : "ghost"}
              onClick={() => setSelectedProvider(PROVIDERS.CLAUDE)}
              className="text-xs px-3 py-1.5"
            >
              Claude
            </Button>
            <Button
              variant={selectedProvider === PROVIDERS.CODEX ? "secondary" : "ghost"}
              onClick={() => setSelectedProvider(PROVIDERS.CODEX)}
              className="text-xs px-3 py-1.5"
            >
              Codex
            </Button>
          </div>
          
          <Button
            onClick={fetchQuota}
            disabled={loading}
            className="text-xs px-3 py-1.5"
          >
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      {loading && !quotaData ? (
        <Card>
          <CardContent>
            <div className="py-6 text-center text-sm text-white/60">
              Loading quota data...
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <div className="backdrop-blur-2xl glass-card rounded-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-400 text-lg" aria-hidden="true">&#9679;</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white/50 uppercase tracking-wider">Active Accounts</div>
                  <div className="text-xl font-bold text-white mt-0.5">{activeAccounts}</div>
                  <div className="text-xs text-white/60 mt-0.5">Supported OAuth</div>
                </div>
              </div>
            </div>

            <div
              className="backdrop-blur-2xl glass-card rounded-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
              title={providerSummaries.flatMap(s => s.windowCapacities.filter(w => !w.isShortTerm).map(w => `${s.provider} ${w.label}: ${Math.round(w.capacity * 100)}%`)).join("\n")}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0",
                  overallCapacity.value > 0.6
                    ? "bg-emerald-500/20 border-emerald-400/30"
                    : overallCapacity.value > 0.2
                      ? "bg-amber-500/20 border-amber-400/30"
                      : "bg-red-500/20 border-red-400/30"
                )}>
                  <span className={cn(
                    "text-lg",
                    overallCapacity.value > 0.6
                      ? "text-emerald-400"
                      : overallCapacity.value > 0.2
                        ? "text-amber-400"
                        : "text-red-400"
                  )} aria-hidden="true">&#9650;</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white/50 uppercase tracking-wider">Overall Capacity</div>
                  <div className="text-xl font-bold text-white mt-0.5">
                    {Math.round(overallCapacity.value * 100)}%
                  </div>
                  <div className="text-xs text-white/50 mt-0.5 truncate">
                    {overallCapacity.provider ? (
                      <span className={cn(
                        overallCapacity.value > 0.6 ? "text-emerald-400/70" : overallCapacity.value > 0.2 ? "text-amber-400/70" : "text-red-400/70"
                      )}>
                        {overallCapacity.provider} {overallCapacity.label} bottleneck
                      </span>
                    ) : "No capacity data"}
                  </div>
                </div>
              </div>
            </div>

            <div className="backdrop-blur-2xl glass-card rounded-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)] sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-400/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-red-400 text-lg" aria-hidden="true">&#9888;</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white/50 uppercase tracking-wider">Low Capacity</div>
                  <div className="text-xl font-bold text-white mt-0.5">{lowCapacityCount}</div>
                  <div className="text-xs text-white/60 mt-0.5">Providers below 20%</div>
                </div>
              </div>
            </div>
          </div>

          {providerSummaries.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                Provider Capacity
              </h2>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {providerSummaries.map((summary) => {
                  const longTerm = summary.windowCapacities.filter(w => !w.isShortTerm);
                  const shortTerm = summary.windowCapacities.filter(w => w.isShortTerm);
                  const hasLongTerm = longTerm.length > 0;
                  const hasShortTerm = shortTerm.length > 0;
                  const hasBoth = hasLongTerm && hasShortTerm;

                  const relevantForHeader = hasLongTerm ? longTerm : summary.windowCapacities;
                  const minCap = relevantForHeader.length > 0
                    ? Math.min(...relevantForHeader.map(w => w.capacity))
                    : 0;
                  const headerPct = Math.round(minCap * 100);

                  const renderBar = (w: WindowCapacity, heightClass: string) => {
                    const pct = Math.round(w.capacity * 100);
                    return (
                      <div key={w.id} className="mb-1.5 last:mb-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-white/70 truncate mr-2">{w.label}</span>
                          <span className="text-[10px] font-medium text-white/70">{pct}%</span>
                        </div>
                        <div className={cn("w-full rounded-full bg-white/10 overflow-hidden", heightClass)}>
                          <div
                            className={cn("h-full transition-all duration-500", getProgressColor(w.capacity))}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="mt-0.5 text-[10px] text-white/40">
                          {formatRelativeTime(w.resetTime)}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div
                      key={summary.provider}
                      className="backdrop-blur-2xl glass-card rounded-xl p-3 shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
                    >
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/5">
                        <span className="text-sm font-semibold text-white capitalize">
                          {summary.provider}
                        </span>
                        <span className={cn(
                          "text-sm font-bold",
                          minCap > 0.6 ? "text-emerald-400" : minCap > 0.2 ? "text-amber-400" : "text-red-400"
                        )}>
                          {headerPct}%
                        </span>
                      </div>

                      <div className="mb-2">
                        {longTerm.map(w => renderBar(w, "h-2"))}
                        {hasBoth && <div className="border-t border-white/5 my-1.5" />}
                        {shortTerm.map(w => renderBar(w, hasLongTerm ? "h-1.5" : "h-2"))}
                        {!hasLongTerm && hasShortTerm && (
                          <div className="text-[10px] text-white/30 text-center mt-1">Weekly data unavailable</div>
                        )}
                        {summary.windowCapacities.length === 0 && (
                          <div className="text-xs text-white/40 text-center py-2">No quota data</div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                        <span className="text-xs text-white/50">
                          {summary.healthyAccounts}/{summary.totalAccounts} accounts healthy
                        </span>
                        {summary.errorAccounts > 0 && (
                          <span className="text-xs text-amber-400/80 flex items-center gap-0.5">
                            &#9888; {summary.errorAccounts}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
            {filteredAccounts.map((account) => {
              const statusBadge = account.supported
                ? account.error
                  ? { label: "ERROR", class: "bg-red-500/20 border-red-400/40 text-red-300" }
                  : { label: "ACTIVE", class: "bg-emerald-500/20 border-emerald-400/40 text-emerald-300" }
                : { label: "NOT SUPPORTED", class: "bg-amber-500/20 border-amber-400/40 text-amber-300" };

              const isCardExpanded = expandedCards[account.auth_index];
              
              const scores = account.groups ? Object.values(calcAccountWindowScores(account.groups)) : [];
              const longScores = scores.filter(s => !s.isShortTerm);
              const shortScores = scores.filter(s => s.isShortTerm);
              const longMin = longScores.length > 0 ? Math.min(...longScores.map(s => s.score)) : null;
              const shortMin = shortScores.length > 0 ? Math.min(...shortScores.map(s => s.score)) : null;

              return (
                <div key={account.auth_index} className="backdrop-blur-2xl glass-card rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
                    <button
                      type="button"
                      onClick={() => toggleCard(account.auth_index)}
                      className="w-full text-left p-3 flex items-center justify-between gap-2 hover:bg-white/5 transition-colors duration-150"
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white capitalize flex-shrink-0">
                          {account.provider}
                        </h3>
                        <p className="text-xs text-white/60 truncate flex-shrink min-w-0">{maskEmail(account.email)}</p>
                        
                        {account.supported && !account.error && scores.length > 0 && (
                          <div className="flex flex-col gap-0.5 flex-shrink-0">
                            {longMin !== null && (
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-white/40 w-2">L</span>
                                <div className="w-24 h-1 rounded-full bg-white/10 overflow-hidden">
                                  <div
                                    className={cn("h-full transition-all duration-300", getProgressColor(longMin))}
                                    style={{ width: `${longMin * 100}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-medium text-white/60 w-7 text-right">{Math.round(longMin * 100)}%</span>
                              </div>
                            )}
                            {shortMin !== null && (
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-white/40 w-2">S</span>
                                <div className="w-24 h-1 rounded-full bg-white/10 overflow-hidden">
                                  <div
                                    className={cn("h-full transition-all duration-300", getProgressColor(shortMin))}
                                    style={{ width: `${shortMin * 100}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-medium text-white/60 w-7 text-right">{Math.round(shortMin * 100)}%</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={cn(
                            "backdrop-blur-xl px-2 py-0.5 text-xs font-medium rounded-md border",
                            statusBadge.class
                          )}
                        >
                          {statusBadge.label}
                        </span>
                        <svg
                          className={cn(
                            "w-4 h-4 text-white/40 transition-transform duration-200",
                            isCardExpanded && "rotate-180"
                          )}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </button>

                    {isCardExpanded && (
                      <div className="border-t border-white/10 p-3 space-y-2">
                        {account.error && (
                          <div className="backdrop-blur-xl bg-red-500/10 border border-red-400/30 rounded-lg p-2">
                            <div className="text-xs text-red-200">{account.error}</div>
                          </div>
                        )}

                        {!account.supported && !account.error && (
                          <div className="backdrop-blur-xl bg-amber-500/10 border border-amber-400/30 rounded-lg p-2">
                            <div className="text-xs text-amber-200">
                              Quota monitoring not available for this provider
                            </div>
                          </div>
                        )}

                        {account.groups && account.groups.length > 0 && (
                          <div className="space-y-2">
                            {account.groups.map((group) => {
                              return (
                                <div key={group.id} className="backdrop-blur-xl bg-white/5 rounded-lg p-2 border border-white/10">
                                  <div className="w-full text-left">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-xs font-semibold text-white">{group.label}</span>
                                      <span className="text-xs font-medium text-white/70">
                                        {Math.round(group.remainingFraction * 100)}%
                                      </span>
                                    </div>
                                    
                                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                                      <div
                                        className={cn(
                                          "h-full transition-all duration-300",
                                          getProgressColor(group.remainingFraction)
                                        )}
                                        style={{ width: `${group.remainingFraction * 100}%` }}
                                      />
                                    </div>
                                    
                                    <div className="mt-1 text-xs text-white/50">
                                      {formatRelativeTime(group.resetTime)}
                                    </div>
                                  </div>
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
            <Card>
              <CardContent>
                <div className="text-center text-white/60 py-6 text-sm">
                  No accounts found for the selected filter
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
