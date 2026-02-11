"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface TokenStats {
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  total_tokens: number;
}

interface RequestDetail {
  timestamp: string;
  source: string;
  auth_index: string;
  tokens: TokenStats;
  failed: boolean;
}

interface ModelSnapshot {
  total_requests: number;
  total_tokens: number;
  input_tokens?: number;
  output_tokens?: number;
  details?: RequestDetail[];
}

interface ApiEntry {
  total_requests: number;
  success_count: number;
  failure_count: number;
  total_tokens: number;
  input_tokens?: number;
  output_tokens?: number;
  models?: Record<string, ModelSnapshot>;
}

interface ApisMap {
  [key: string]: ApiEntry;
}

interface DayHourMap {
  [key: string]: number;
}

interface UsageStats {
  total_requests: number;
  success_count: number;
  failure_count: number;
  total_tokens: number;
  input_tokens?: number;
  output_tokens?: number;
  apis?: ApisMap;
  requests_by_day?: DayHourMap;
  requests_by_hour?: DayHourMap;
  tokens_by_day?: DayHourMap;
  tokens_by_hour?: DayHourMap;
}

interface FetchUsageParams {
  setStats: (stats: UsageStats | null) => void;
  setLoading: (loading: boolean) => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
  isFirstLoad: boolean;
}

async function fetchUsage(params: FetchUsageParams) {
  const { setStats, setLoading, showToast, isFirstLoad } = params;
  
  if (isFirstLoad) {
    setLoading(true);
  }
  
  try {
    const res = await fetch("/api/usage");
    
    if (!res.ok) {
      showToast("Failed to load usage statistics", "error");
      setLoading(false);
      return;
    }

    const data = await res.json();
    const usage = data?.data ?? data;
    setStats({
      total_requests: usage?.total_requests ?? 0,
      success_count: usage?.success_count ?? 0,
      failure_count: usage?.failure_count ?? 0,
      total_tokens: usage?.total_tokens ?? 0,
      apis: usage?.apis ?? undefined,
      requests_by_day: usage?.requests_by_day ?? undefined,
      requests_by_hour: usage?.requests_by_hour ?? undefined,
      tokens_by_day: usage?.tokens_by_day ?? undefined,
      tokens_by_hour: usage?.tokens_by_hour ?? undefined,
    });
    setLoading(false);
  } catch {
    showToast("Network error", "error");
    setLoading(false);
  }
}

export default function UsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedApis, setExpandedApis] = useState<Set<string>>(new Set());
  const { showToast } = useToast();
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    void fetchUsage({ 
      setStats, 
      setLoading, 
      showToast, 
      isFirstLoad: isFirstLoadRef.current 
    });
    
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
    }
    
    const interval = setInterval(() => {
      void fetchUsage({ 
        setStats, 
        setLoading: () => {},
        showToast, 
        isFirstLoad: false
      });
    }, 30000);
    
    return () => clearInterval(interval);
  }, [showToast]);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let hasTokenBreakdown = false;

  if (stats?.apis) {
    for (const entry of Object.values(stats.apis)) {
      const apiEntry = entry as Partial<ApiEntry>;
      if (apiEntry.input_tokens !== undefined && apiEntry.output_tokens !== undefined) {
        totalInputTokens += apiEntry.input_tokens;
        totalOutputTokens += apiEntry.output_tokens;
        hasTokenBreakdown = true;
      }
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
        <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">Usage Statistics</h1>
            <p className="mt-1 text-xs text-slate-400">Auto-refreshes every 30s</p>
        </div>
        <Button
          onClick={() => {
            isFirstLoadRef.current = true;
            void fetchUsage({ 
              setStats, 
              setLoading, 
              showToast, 
              isFirstLoad: true 
            });
          }}
          disabled={loading}
        >
          Refresh
        </Button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-6 text-center text-sm text-slate-400">
          Loading statistics...
        </div>
      ) : !stats ? (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          Unable to load usage statistics
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Total Requests</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">{(stats.total_requests ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Successful</p>
              <p className="mt-0.5 text-xs font-semibold text-emerald-300">{(stats.success_count ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Failed</p>
              <p className="mt-0.5 text-xs font-semibold text-rose-300">{(stats.failure_count ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Total Tokens</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">{(stats.total_tokens ?? 0).toLocaleString()}</p>
            </div>
          </div>

          {hasTokenBreakdown && (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Input Tokens</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-100">{totalInputTokens.toLocaleString()}</p>
              </div>
              <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Output Tokens</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-100">{totalOutputTokens.toLocaleString()}</p>
              </div>
              <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Total Tokens</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-100">{(stats.total_tokens ?? 0).toLocaleString()}</p>
              </div>
            </div>
          )}

          {stats.apis && Object.keys(stats.apis).length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Usage by API</h2>
              <div className="overflow-x-auto rounded-md border border-slate-700/70 bg-slate-900/25">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-700/70 bg-slate-900/60">
                      <tr>
                        <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 w-8"></th>
                        <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">API Key</th>
                        <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Total</th>
                        <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Success</th>
                        <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Failed</th>
                        <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Tokens</th>
                      </tr>
                    </thead>
                    <tbody>
                       {Object.entries(stats.apis).map(([api, data]) => {
                         const entry = (data && typeof data === "object" ? data : {}) as Partial<ApiEntry>;
                         const isExpanded = expandedApis.has(api);
                         const hasModels = entry.models && Object.keys(entry.models).length > 0;
                         
                         return (
                           <React.Fragment key={api}>
                               <tr
                                className={`border-b border-slate-700/60 ${hasModels ? "cursor-pointer hover:bg-slate-800/40" : ""}`}
                                onClick={() => {
                                 if (hasModels) {
                                   setExpandedApis(prev => {
                                     const next = new Set(prev);
                                     if (next.has(api)) {
                                       next.delete(api);
                                     } else {
                                       next.add(api);
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
                                <td className="p-2 font-mono text-xs text-slate-200">{api}</td>
                                <td className="p-2 text-right text-xs text-slate-300">{(entry.total_requests ?? 0).toLocaleString()}</td>
                                <td className="p-2 text-right text-xs text-slate-300">{(entry.success_count ?? 0).toLocaleString()}</td>
                                <td className="p-2 text-right text-xs text-slate-300">{(entry.failure_count ?? 0).toLocaleString()}</td>
                                <td className="p-2 text-right text-xs text-slate-300">{(entry.total_tokens ?? 0).toLocaleString()}</td>
                              </tr>
                             
                             {isExpanded && hasModels && (
                                <tr>
                                  <td colSpan={6} className="p-0 bg-slate-900/25">
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
                                         {Object.entries(entry.models!).map(([modelName, modelData]) => {
                                           const model = modelData as ModelSnapshot;
                                           return (
                                              <tr key={modelName} className="border-b border-slate-700/40 last:border-0">
                                                <td className="p-2 text-left font-mono text-[11px] text-slate-300">{modelName}</td>
                                                <td className="p-2 text-right text-slate-400">{(model.total_requests ?? 0).toLocaleString()}</td>
                                                <td className="p-2 text-right text-slate-400">{(model.input_tokens ?? 0).toLocaleString()}</td>
                                                <td className="p-2 text-right text-slate-400">{(model.output_tokens ?? 0).toLocaleString()}</td>
                                                <td className="p-2 text-right text-slate-400">{(model.total_tokens ?? 0).toLocaleString()}</td>
                                              </tr>
                                            );
                                          })}
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
