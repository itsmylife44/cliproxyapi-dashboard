"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartContainer, CHART_COLORS, SERIES_PALETTE, AXIS_TICK_STYLE, TOOLTIP_STYLE, formatCompact, formatDateShort } from "@/components/ui/chart-theme";

interface KeyUsage {
  keyName: string;
  username?: string;
  userId?: string;
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  successCount: number;
  failureCount: number;
  models: Record<string, {
    totalRequests: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
  }>;
}

interface UsageData {
  keys: Record<string, KeyUsage>;
  totals: {
    totalRequests: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    successCount: number;
    failureCount: number;
  };
  period: { from: string; to: string };
  collectorStatus: { lastCollectedAt: string; lastStatus: string };
  dailyBreakdown?: Array<{
    date: string;
    requests: number;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    success: number;
    failure: number;
  }>;
  modelBreakdown?: Array<{
    model: string;
    requests: number;
    tokens: number;
  }>;
}

interface UsageResponse {
  data: UsageData;
  isAdmin: boolean;
}

type DateFilter = "today" | "7d" | "30d" | "all" | "custom";

function shouldPollDashboard(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateRange(period: DateFilter, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  const to = toLocalDateString(now);
  switch (period) {
    case "today": return { from: to, to };
    case "7d": {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      return { from: toLocalDateString(d), to };
    }
    case "30d": {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      return { from: toLocalDateString(d), to };
    }
    case "all": return { from: "2020-01-01", to: "2099-12-31" };
    case "custom": return { from: customFrom || to, to: customTo || to };
    default: return { from: "2020-01-01", to: "2099-12-31" };
  }
}

function getRelativeTime(isoString: string): string {
  if (!isoString) return "Never";
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getStatusColor(isoString: string): string {
  if (!isoString) return "bg-red-500";
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 10) return "bg-emerald-500";
  if (minutes < 30) return "bg-yellow-500";
  return "bg-red-500";
}

export default function UsagePage() {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const isAdminRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<DateFilter>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const { showToast } = useToast();
  const isFirstLoadRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    async function collectAndFetch(showLoading: boolean) {
      if (showLoading) {
        setLoading(true);
      }

      try {
        const { from, to } = getDateRange(activeFilter, customFrom, customTo);
        const res = await fetch(`/api/usage/history?from=${from}&to=${to}`, { signal: abortController.signal });

        if (!res.ok) {
          showToast("Failed to load usage data", "error");
          setLoading(false);
          return;
        }

        const json: UsageResponse = await res.json();
        if (abortController.signal.aborted) return;
        setUsageData(json.data);
        isAdminRef.current = json.isAdmin;
        setIsAdmin(json.isAdmin);
        setLoading(false);
      } catch {
        if (abortController.signal.aborted) return;
        showToast("Network error", "error");
        setLoading(false);
      }
    }

    void collectAndFetch(isFirstLoadRef.current);
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
    }

    intervalRef.current = setInterval(() => {
      if (!shouldPollDashboard()) return;
      void collectAndFetch(false);
    }, 300000);

    return () => {
      abortController.abort();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeFilter, customFrom, customTo, showToast]);

  const handleFilterChange = (filter: DateFilter) => {
    setActiveFilter(filter);
    isFirstLoadRef.current = true;
  };

  const handleCustomDateChange = () => {
    if (customFrom && customTo) {
      handleFilterChange("custom");
    }
  };

  const handleRefresh = async () => {
    isFirstLoadRef.current = true;
    setLoading(true);

    try {
      if (isAdmin) {
        try {
          await fetch("/api/usage/collect", { method: "POST" });
        } catch {
          /* Silently continue if collector is unreachable */
        }
      }

      const { from, to } = getDateRange(activeFilter, customFrom, customTo);
      const res = await fetch(`/api/usage/history?from=${from}&to=${to}`);

      if (!res.ok) {
        showToast("Failed to load usage data", "error");
        setLoading(false);
        return;
      }

      const json: UsageResponse = await res.json();
      setUsageData(json.data);
      setIsAdmin(json.isAdmin);
      setLoading(false);
    } catch {
      showToast("Network error", "error");
      setLoading(false);
    }
  };

  const hasInputOutputBreakdown = usageData && (usageData.totals.inputTokens > 0 || usageData.totals.outputTokens > 0);
  const collectorStatusColor = usageData ? getStatusColor(usageData.collectorStatus.lastCollectedAt) : "bg-gray-500";
  const collectorTimeAgo = usageData ? getRelativeTime(usageData.collectorStatus.lastCollectedAt) : "Unknown";

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">Usage Statistics</h1>
            <div className="mt-1 flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${collectorStatusColor}`}></div>
              <p className="text-xs text-slate-400">Last synced: {collectorTimeAgo}</p>
            </div>
          </div>
          <Button onClick={handleRefresh} disabled={loading}>
            Refresh
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Time Period</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => handleFilterChange("today")}
            variant={activeFilter === "today" ? "primary" : "secondary"}
            className="text-xs"
          >
            Today
          </Button>
          <Button
            onClick={() => handleFilterChange("7d")}
            variant={activeFilter === "7d" ? "primary" : "secondary"}
            className="text-xs"
          >
            7 Days
          </Button>
          <Button
            onClick={() => handleFilterChange("30d")}
            variant={activeFilter === "30d" ? "primary" : "secondary"}
            className="text-xs"
          >
            30 Days
          </Button>
          <Button
            onClick={() => handleFilterChange("all")}
            variant={activeFilter === "all" ? "primary" : "secondary"}
            className="text-xs"
          >
            All Time
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="custom-from" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">From</label>
            <input
              id="custom-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2 py-1 text-xs text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="custom-to" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">To</label>
            <input
              id="custom-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2 py-1 text-xs text-slate-100"
            />
          </div>
          <Button onClick={handleCustomDateChange} disabled={!customFrom || !customTo} className="text-xs">
            Apply
          </Button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-6 text-center text-sm text-slate-400">
          Loading statistics...
        </div>
      ) : !usageData ? (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          Unable to load usage statistics
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
            <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Total Requests</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">{usageData.totals.totalRequests.toLocaleString()}</p>
            </div>
            <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Successful</p>
              <p className="mt-0.5 text-xs font-semibold text-emerald-300">{usageData.totals.successCount.toLocaleString()}</p>
            </div>
            <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Failed</p>
              <p className="mt-0.5 text-xs font-semibold text-rose-300">{usageData.totals.failureCount.toLocaleString()}</p>
            </div>
            <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Total Tokens</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">{usageData.totals.totalTokens.toLocaleString()}</p>
            </div>
          </div>

          {hasInputOutputBreakdown && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
              <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Input Tokens</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-100">{usageData.totals.inputTokens.toLocaleString()}</p>
              </div>
              <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Output Tokens</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-100">{usageData.totals.outputTokens.toLocaleString()}</p>
              </div>
              <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Total Tokens</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-100">{usageData.totals.totalTokens.toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* ── Charts section ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Line Chart: daily request trends */}
            {usageData.dailyBreakdown && usageData.dailyBreakdown.length > 0 ? (
              <ChartContainer title="Daily Requests">
                <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
                  <LineChart data={usageData.dailyBreakdown} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                    <XAxis dataKey="date" tickFormatter={formatDateShort} tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={formatCompact} tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      labelFormatter={(label) => formatDateShort(label)}
                      formatter={(value) => [formatCompact(Number(value)), "Requests"]}
                    />
                    <Line type="monotone" dataKey="requests" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : null}

            {/* Area Chart: token usage over time */}
            {usageData.dailyBreakdown && usageData.dailyBreakdown.length > 0 ? (
              <ChartContainer title="Token Usage">
                <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
                  <AreaChart data={usageData.dailyBreakdown} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradInput" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradOutput" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                    <XAxis dataKey="date" tickFormatter={formatDateShort} tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={formatCompact} tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      labelFormatter={(label) => formatDateShort(label)}
                      formatter={(value) => [formatCompact(Number(value)), ""]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, color: CHART_COLORS.text.muted }} />
                    <Area type="monotone" dataKey="inputTokens" name="Input" stackId="1" stroke={CHART_COLORS.primary} fill="url(#gradInput)" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="outputTokens" name="Output" stackId="1" stroke={CHART_COLORS.success} fill="url(#gradOutput)" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : null}

            {/* Pie Chart: model distribution donut */}
            {usageData.modelBreakdown && usageData.modelBreakdown.length > 0 ? (() => {
              const sorted = [...usageData.modelBreakdown].sort((a, b) => b.requests - a.requests);
              const top6 = sorted.slice(0, 6);
              const rest = sorted.slice(6);
              const otherRequests = rest.reduce((s, m) => s + m.requests, 0);
              const pieData = otherRequests > 0
                ? [...top6, { model: "Other", requests: otherRequests, tokens: 0 }]
                : top6;
              return (
                <ChartContainer title="Model Distribution">
                  <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="requests"
                        nameKey="model"
                        innerRadius={52}
                        outerRadius={84}
                        paddingAngle={2}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={entry.model} fill={SERIES_PALETTE[index % SERIES_PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(value) => [formatCompact(Number(value)), "Requests"]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 10, color: CHART_COLORS.text.muted }}
                        formatter={(value) => value.length > 20 ? value.slice(0, 18) + "\u2026" : value}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              );
            })() : null}

            {/* Success/Failure ratio: div-based horizontal bar */}
            {usageData.totals.totalRequests > 0 ? (() => {
              const total = usageData.totals.successCount + usageData.totals.failureCount;
              const successPct = total > 0 ? (usageData.totals.successCount / total) * 100 : 0;
              const failPct = total > 0 ? (usageData.totals.failureCount / total) * 100 : 0;
              return (
                <ChartContainer title="Success / Failure Ratio">
                  <div className="flex h-[220px] flex-col justify-center gap-4 px-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-emerald-400">{usageData.totals.successCount.toLocaleString()} success</span>
                      <span className="font-semibold text-rose-400">{usageData.totals.failureCount.toLocaleString()} failed</span>
                    </div>
                    <div className="h-4 w-full overflow-hidden rounded-full bg-slate-800">
                      <div className="flex h-full">
                        {successPct > 0 && (
                          <div
                            className="h-full bg-emerald-500 transition-all duration-700"
                            style={{ width: `${successPct}%` }}
                          />
                        )}
                        {failPct > 0 && (
                          <div
                            className="h-full bg-rose-500 transition-all duration-700"
                            style={{ width: `${failPct}%` }}
                          />
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Success Rate</p>
                        <p className="mt-0.5 text-lg font-bold text-emerald-400">{successPct.toFixed(1)}%</p>
                      </div>
                      <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Failure Rate</p>
                        <p className="mt-0.5 text-lg font-bold text-rose-400">{failPct.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                </ChartContainer>
              );
            })() : null}
          </div>
          {/* ── End charts section ───────────────────────────────────── */}

          {Object.keys(usageData.keys).length === 0 ? (
            <section className="rounded-md border border-slate-700/70 bg-slate-900/25 p-6 text-center">
              <p className="text-sm text-slate-400">No usage data yet</p>
            </section>
          ) : (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Usage by API Key</h2>
              <div className="overflow-x-auto">
                <div className="min-w-[600px] rounded-md border border-slate-700/70 bg-slate-900/25">
                  <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 border-b border-slate-700/70 bg-slate-900/95 backdrop-blur-sm">
                    <tr>
                      <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 w-8"></th>
                      <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Key Name</th>
                      {isAdmin && (
                        <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Username</th>
                      )}
                      <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Total</th>
                      <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Success</th>
                      <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Failed</th>
                      <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(usageData.keys).map(([authIndex, keyUsage]) => {
                      const isExpanded = expandedKeys.has(authIndex);
                      const hasModels = Object.keys(keyUsage.models).length > 0;

                      return (
                        <React.Fragment key={authIndex}>
                          <tr
                            className={`border-b border-slate-700/60 ${hasModels ? "cursor-pointer hover:bg-slate-800/40" : ""}`}
                            onClick={() => {
                              if (hasModels) {
                                setExpandedKeys(prev => {
                                  const next = new Set(prev);
                                  if (next.has(authIndex)) {
                                    next.delete(authIndex);
                                  } else {
                                    next.add(authIndex);
                                  }
                                  return next;
                                });
                              }
                            }}
                          >
                            <td className="p-2 text-slate-400">
                              {hasModels && (
                                <span className="text-xs">
                                  {isExpanded ? "▼" : "▶"}
                                </span>
                              )}
                            </td>
                            <td className="p-2 font-mono text-xs text-slate-200">{keyUsage.keyName}</td>
                            {isAdmin && (
                              <td className="p-2 text-xs text-slate-300">{keyUsage.username || "—"}</td>
                            )}
                            <td className="p-2 text-right text-xs text-slate-300">{keyUsage.totalRequests.toLocaleString()}</td>
                            <td className="p-2 text-right text-xs text-slate-300">{keyUsage.successCount.toLocaleString()}</td>
                            <td className="p-2 text-right text-xs text-slate-300">{keyUsage.failureCount.toLocaleString()}</td>
                            <td className="p-2 text-right text-xs text-slate-300">{keyUsage.totalTokens.toLocaleString()}</td>
                          </tr>

                          {isExpanded && hasModels && (
                            <tr>
                              <td colSpan={isAdmin ? 7 : 6} className="p-0 bg-slate-900/25">
                                <div className="p-3 pl-8">
                                  <table className="w-full text-xs">
                                    <thead className="border-b border-slate-700/60">
                                      <tr>
                                        <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Model</th>
                                        <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Requests</th>
                                        <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Input</th>
                                        <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Output</th>
                                        <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {Object.entries(keyUsage.models).map(([modelName, modelData]) => (
                                        <tr key={modelName} className="border-b border-slate-700/40 last:border-0">
                                          <td className="p-2 text-left font-mono text-[11px] text-slate-300">{modelName}</td>
                                          <td className="p-2 text-right text-slate-400">{modelData.totalRequests.toLocaleString()}</td>
                                          <td className="p-2 text-right text-slate-400">{modelData.inputTokens.toLocaleString()}</td>
                                          <td className="p-2 text-right text-slate-400">{modelData.outputTokens.toLocaleString()}</td>
                                          <td className="p-2 text-right text-slate-400">{modelData.totalTokens.toLocaleString()}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
