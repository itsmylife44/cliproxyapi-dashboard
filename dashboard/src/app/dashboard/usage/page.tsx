"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

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
}

interface UsageResponse {
  data: UsageData;
  isAdmin: boolean;
}

type DateFilter = "today" | "7d" | "30d" | "all" | "custom";

function getDateRange(period: DateFilter, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  switch (period) {
    case "today": return { from: to, to };
    case "7d": {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      return { from: d.toISOString().split("T")[0], to };
    }
    case "30d": {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      return { from: d.toISOString().split("T")[0], to };
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
  const [loading, setLoading] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<DateFilter>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const { showToast } = useToast();
  const isFirstLoadRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function collectAndFetch(showLoading: boolean) {
      if (showLoading) {
        setLoading(true);
      }

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
    }

    void collectAndFetch(isFirstLoadRef.current);
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
    }

    intervalRef.current = setInterval(() => {
      void collectAndFetch(false);
    }, 300000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeFilter, customFrom, customTo, isAdmin, showToast]);

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
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
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
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
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

          {Object.keys(usageData.keys).length === 0 ? (
            <section className="rounded-md border border-slate-700/70 bg-slate-900/25 p-6 text-center">
              <p className="text-sm text-slate-400">No usage data yet</p>
            </section>
          ) : (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Usage by API Key</h2>
              <div className="overflow-x-auto rounded-md border border-slate-700/70 bg-slate-900/25">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-700/70 bg-slate-900/60">
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
            </section>
          )}
        </>
      )}
    </div>
  );
}
