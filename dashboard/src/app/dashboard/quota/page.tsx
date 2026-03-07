"use client";

import { RadialBarChart, RadialBar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartEmpty, CHART_COLORS, TOOLTIP_STYLE, AXIS_TICK_STYLE } from "@/components/ui/chart-theme";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { HelpTooltip } from "@/components/ui/tooltip";
import type { QuotaResponse, QuotaAccount, ProviderSummary, ProviderType } from "./_components/quota-types";
import { PROVIDERS } from "./_components/quota-types";
import { normalizeFraction, maskEmail, formatRelativeTime, calcAccountWindowScores, calcProviderSummary, calcOverallCapacity, getCapacityBarClass } from "./_components/quota-utils";
import { TelegramAlertsSection } from "./_components/telegram-alerts-section";

const REFRESH_INTERVAL_MS = 120_000;
const SCROLL_DELAY_MS = 50;
const LOW_CAPACITY_THRESHOLD = 0.2;

const PROVIDER_FILTERS = [
  { key: PROVIDERS.ALL, label: "All" },
  { key: PROVIDERS.ANTIGRAVITY, label: "Antigravity" },
  { key: PROVIDERS.CLAUDE, label: "Claude" },
  { key: PROVIDERS.CODEX, label: "Codex" },
  { key: PROVIDERS.COPILOT, label: "Copilot" },
  { key: PROVIDERS.KIMI, label: "Kimi" },
] as const;

function useQuotaData() {
  const [quotaData, setQuotaData] = useState<QuotaResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQuota = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quota");
      if (res.ok) {
        const data = await res.json();
        setQuotaData(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuota();
    const interval = setInterval(fetchQuota, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return { quotaData, loading, fetchQuota };
}

function filterAccounts(accounts: QuotaAccount[] | undefined, provider: ProviderType): QuotaAccount[] {
  if (!accounts) return [];
  if (provider === PROVIDERS.ALL) return accounts;
  if (provider === PROVIDERS.COPILOT) {
    return accounts.filter((a) => a.provider === "github" || a.provider === "github-copilot");
  }
  return accounts.filter((a) => a.provider === provider);
}

function buildProviderSummaries(accounts: QuotaAccount[]): ProviderSummary[] {
  const providerGroups = new Map<string, QuotaAccount[]>();
  for (const account of accounts) {
    const existing = providerGroups.get(account.provider) ?? [];
    providerGroups.set(account.provider, [...existing, account]);
  }
  return Array.from(providerGroups.values())
    .map((group) => calcProviderSummary(group))
    .sort((a, b) => b.healthyAccounts - a.healthyAccounts);
}

function CapacityGauge({ summaries }: { summaries: ProviderSummary[] }) {
  const overallCapacity = calcOverallCapacity(summaries);

  if (summaries.length === 0) return <ChartEmpty message="No provider data" />;

  const pct = Math.round(overallCapacity.value * 100);
  const gaugeColor = overallCapacity.value > 0.6 ? CHART_COLORS.success : overallCapacity.value > 0.2 ? CHART_COLORS.warning : CHART_COLORS.danger;
  const gaugeData = [{ value: pct, fill: gaugeColor }];

  return (
    <div className="relative flex h-48 items-center justify-center">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
        <RadialBarChart cx="50%" cy="60%" innerRadius="55%" outerRadius="80%" startAngle={210} endAngle={-30} data={[{ value: 100, fill: "rgba(148,163,184,0.1)" }, ...gaugeData]} barSize={14}>
          <RadialBar dataKey="value" background={false} cornerRadius={4} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color: gaugeColor }}>{pct}%</span>
        <span className="mt-0.5 text-[10px] uppercase tracking-widest" style={{ color: CHART_COLORS.text.dimmed }}>Capacity</span>
      </div>
    </div>
  );
}

function ProviderCapacityChart({ summaries }: { summaries: ProviderSummary[] }) {
  if (summaries.length === 0) return <ChartEmpty message="No provider data" />;

  const barData = summaries.map((s) => {
    const longTerm = s.windowCapacities.filter((w) => !w.isShortTerm);
    const shortTerm = s.windowCapacities.filter((w) => w.isShortTerm);
    return {
      provider: s.provider,
      longTerm: longTerm.length > 0 ? Math.round(Math.min(...longTerm.map((w) => w.capacity)) * 100) : null,
      shortTerm: shortTerm.length > 0 ? Math.round(Math.min(...shortTerm.map((w) => w.capacity)) * 100) : null,
      healthy: s.healthyAccounts,
      total: s.totalAccounts,
      issues: s.errorAccounts,
    };
  });

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
        <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }} barSize={8} barGap={2}>
          <XAxis type="number" domain={[0, 100]} tick={AXIS_TICK_STYLE} tickLine={false} axisLine={{ stroke: CHART_COLORS.border }} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="provider" tick={{ ...AXIS_TICK_STYLE, fontSize: 10 }} tickLine={false} axisLine={false} width={72} />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value, name, props) => {
              if (value === null) return ["-", name];
              const label = name === "longTerm" ? "Long-Term" : "Short-Term";
              const extra = name === "longTerm" ? ` (${props.payload.healthy}/${props.payload.total} healthy${props.payload.issues > 0 ? `, ${props.payload.issues} issues` : ""})` : "";
              return [`${value}%${extra}`, label];
            }}
          />
          <Legend verticalAlign="top" height={24} formatter={(value: string) => value === "longTerm" ? "Long-Term" : "Short-Term"} wrapperStyle={{ fontSize: 10, color: CHART_COLORS.text.dimmed }} />
          <Bar dataKey="longTerm" radius={[0, 3, 3, 0]} fill={CHART_COLORS.success} />
          <Bar dataKey="shortTerm" radius={[0, 3, 3, 0]} fill={CHART_COLORS.cyan} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AccountRow({ account, isExpanded, onToggle }: { account: QuotaAccount; isExpanded: boolean; onToggle: () => void }) {
  const scores = account.groups ? Object.values(calcAccountWindowScores(account.groups)) : [];
  const longScores = scores.filter((s) => !s.isShortTerm);
  const shortScores = scores.filter((s) => s.isShortTerm);
  const longMin = longScores.length > 0 ? Math.min(...longScores.map((s) => s.score)) : null;
  const shortMin = shortScores.length > 0 ? Math.min(...shortScores.map((s) => s.score)) : null;
  const statusLabel = account.supported ? (account.error ? "Error" : "Active") : "Unsupported";

  return (
    <div className="border-b border-slate-700/60 last:border-b-0">
      <button type="button" onClick={onToggle} className="grid w-full grid-cols-[24px_minmax(0,1fr)_120px_120px_140px_140px] items-center px-3 py-2 text-left transition-colors hover:bg-slate-800/40">
        <span className={cn("text-xs text-slate-500 transition-transform", isExpanded && "rotate-180")}>⌄</span>
        <span className="truncate text-xs text-slate-200">{maskEmail(account.email)}</span>
        <span className="truncate text-xs capitalize text-slate-300">{account.provider}</span>
        <span className={cn("text-xs", account.error ? "text-rose-300" : account.supported ? "text-emerald-300" : "text-amber-300")}>{statusLabel}</span>
        <CapacityCell value={longMin} />
        <CapacityCell value={shortMin} />
      </button>
      {isExpanded && (
        <div className="border-t border-slate-700/60 bg-slate-900/30 px-4 py-3">
          {account.error && <p className="mb-2 break-all text-xs text-rose-300">{account.error}</p>}
          {!account.supported && !account.error && <p className="mb-2 text-xs text-amber-300">Quota monitoring not available for this provider.</p>}
          {account.groups && account.groups.length > 0 && (
            <div className="overflow-x-auto rounded-sm border border-slate-700/70">
              <div className="min-w-[400px]">
                {account.groups.map((group) => {
                  const fraction = normalizeFraction(group.remainingFraction);
                  const pct = fraction === null ? null : Math.round(fraction * 100);
                  return (
                    <div key={group.id} className="grid grid-cols-[minmax(0,1fr)_80px_160px] items-center border-b border-slate-700/60 bg-slate-900/20 px-3 py-2 last:border-b-0">
                      <span className="truncate text-xs text-slate-200">{group.label}</span>
                      <span className="text-xs text-slate-300">{pct === null ? "-" : `${pct}%`}</span>
                      <span className="truncate text-xs text-slate-500">{formatRelativeTime(group.resetTime)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CapacityCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-slate-500">-</span>;
  return (
    <div className="pr-3">
      <span className="text-xs text-slate-300">{Math.round(value * 100)}%</span>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/70">
        <div className={cn("h-full", getCapacityBarClass(value))} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

export default function QuotaPage() {
  const { quotaData, loading, fetchQuota } = useQuotaData();
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>(PROVIDERS.ALL);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const filteredAccounts = filterAccounts(quotaData?.accounts, selectedProvider);
  const activeAccounts = filteredAccounts.filter((a) => a.supported && !a.error).length;
  const providerSummaries = buildProviderSummaries(filteredAccounts);
  const overallCapacity = calcOverallCapacity(providerSummaries);
  const lowCapacityCount = providerSummaries.filter(
    (s) => s.windowCapacities.some((w) => w.capacity < LOW_CAPACITY_THRESHOLD) && s.totalAccounts > 0
  ).length;

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
              {PROVIDER_FILTERS.map((filter) => (
                <Button
                  key={filter.key}
                  variant={selectedProvider === filter.key ? "secondary" : "ghost"}
                  onClick={() => {
                    setSelectedProvider(filter.key);
                    if (filter.key !== PROVIDERS.ALL) {
                      setTimeout(() => {
                        document.getElementById("quota-accounts")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }, SCROLL_DELAY_MS);
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
        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-6 text-center text-sm text-slate-400">Loading quota data...</div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Active Accounts</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">{activeAccounts}</p>
            </div>
            <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Overall Capacity <HelpTooltip content="Weighted average of remaining quota across all active provider accounts" /></p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">{Math.round(overallCapacity.value * 100)}%</p>
            </div>
            <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Low Capacity <HelpTooltip content="Number of accounts with remaining quota below 20%" /></p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">{lowCapacityCount}</p>
            </div>
            <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Providers</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">{providerSummaries.length}</p>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ChartContainer title="Overall Capacity" subtitle="Weighted across all providers">
              <CapacityGauge summaries={providerSummaries} />
            </ChartContainer>
            <ChartContainer title="Provider Capacity" subtitle="Long-term & short-term window minimum per provider">
              <ProviderCapacityChart summaries={providerSummaries} />
            </ChartContainer>
          </section>

          <section id="quota-accounts" className="scroll-mt-24 space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Accounts</h2>
            <div className="overflow-x-auto rounded-md border border-slate-700/70 bg-slate-900/25">
              <div className="min-w-[650px]">
                <div className="grid grid-cols-[24px_minmax(0,1fr)_120px_120px_140px_140px] border-b border-slate-700/70 bg-slate-900/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  <span></span>
                  <span>Account</span>
                  <span>Provider</span>
                  <span>Status</span>
                  <span>Long-Term</span>
                  <span>Short-Term</span>
                </div>
                {filteredAccounts.map((account) => (
                  <AccountRow
                    key={account.auth_index}
                    account={account}
                    isExpanded={!!expandedCards[account.auth_index]}
                    onToggle={() => toggleCard(account.auth_index)}
                  />
                ))}
              </div>
            </div>
            {filteredAccounts.length === 0 && !loading && (
              <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-6 text-center text-sm text-slate-400">No accounts found for the selected filter.</div>
            )}
          </section>
        </>
      )}

      <TelegramAlertsSection />
    </div>
  );
}
