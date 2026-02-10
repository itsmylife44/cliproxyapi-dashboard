"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg">
            Usage Statistics
          </h1>
          <p className="mt-1 text-xs text-white/50">
            Auto-refreshes every 30s
          </p>
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

      {loading ? (
        <Card>
          <CardContent>
            <div className="p-8 text-center text-white">Loading statistics...</div>
          </CardContent>
        </Card>
      ) : !stats ? (
        <Card>
          <CardContent>
            <div className="border-l-4 border-red-400/60 backdrop-blur-xl bg-red-500/20 p-4 text-sm text-white rounded-r-xl">
              Unable to load usage statistics
            </div>
          </CardContent>
        </Card>
       ) : (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Total Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-l-4 border-purple-400/60 p-4 backdrop-blur-xl bg-white/5 rounded-r-xl">
                  <div className="text-3xl font-bold text-white">
                    {(stats.total_requests ?? 0).toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs font-medium text-white/70">
                    Total Requests
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Successful</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-l-4 border-green-400/60 p-4 backdrop-blur-xl bg-white/5 rounded-r-xl">
                  <div className="text-3xl font-bold text-white">
                    {(stats.success_count ?? 0).toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs font-medium text-white/70">
                    Successful Requests
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-l-4 border-red-400/60 p-4 backdrop-blur-xl bg-white/5 rounded-r-xl">
                  <div className="text-3xl font-bold text-white">
                    {(stats.failure_count ?? 0).toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs font-medium text-white/70">
                    Failed Requests
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Token breakdown cards */}
          {(() => {
            let totalInputTokens = 0;
            let totalOutputTokens = 0;
            let hasTokenBreakdown = false;

            if (stats.apis) {
              for (const entry of Object.values(stats.apis)) {
                const apiEntry = entry as Partial<ApiEntry>;
                if (apiEntry.input_tokens !== undefined && apiEntry.output_tokens !== undefined) {
                  totalInputTokens += apiEntry.input_tokens;
                  totalOutputTokens += apiEntry.output_tokens;
                  hasTokenBreakdown = true;
                }
              }
            }

            return hasTokenBreakdown ? (
              <div className="grid gap-6 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Input Tokens</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border-l-4 border-cyan-400/60 p-4 backdrop-blur-xl bg-white/5 rounded-r-xl">
                      <div className="text-3xl font-bold text-white">
                        {totalInputTokens.toLocaleString()}
                      </div>
                      <div className="mt-1 text-xs font-medium text-white/70">
                        Tokens Sent
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Output Tokens</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border-l-4 border-amber-400/60 p-4 backdrop-blur-xl bg-white/5 rounded-r-xl">
                      <div className="text-3xl font-bold text-white">
                        {totalOutputTokens.toLocaleString()}
                      </div>
                      <div className="mt-1 text-xs font-medium text-white/70">
                        Tokens Received
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Total Tokens</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border-l-4 border-blue-400/60 p-4 backdrop-blur-xl bg-white/5 rounded-r-xl">
                      <div className="text-3xl font-bold text-white">
                        {(stats.total_tokens ?? 0).toLocaleString()}
                      </div>
                      <div className="mt-1 text-xs font-medium text-white/70">
                        Total Tokens Consumed
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (stats.total_tokens ?? 0) > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Total Tokens</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border-l-4 border-blue-400/60 p-4 backdrop-blur-xl bg-white/5 rounded-r-xl">
                    <div className="text-3xl font-bold text-white">
                      {(stats.total_tokens ?? 0).toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs font-medium text-white/70">
                      Tokens Consumed
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null;
          })()}

          {stats.apis && Object.keys(stats.apis).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Usage By API</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full backdrop-blur-xl bg-white/5 border border-white/20 rounded-xl text-sm">
                    <thead className="border-b border-white/20 bg-white/5">
                      <tr>
                        <th className="p-3 text-left font-medium text-white/90 w-8"></th>
                        <th className="p-3 text-left font-medium text-white/90">API Key</th>
                        <th className="p-3 text-right font-medium text-white/90">Total</th>
                        <th className="p-3 text-right font-medium text-white/90">Success</th>
                        <th className="p-3 text-right font-medium text-white/90">Failed</th>
                        <th className="p-3 text-right font-medium text-white/90">Tokens</th>
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
                               className={`border-b border-white/10 ${hasModels ? 'cursor-pointer hover:bg-white/5' : ''}`}
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
                               <td className="p-3 text-white/70">
                                 {hasModels && (
                                   <span className="text-xs">
                                     {isExpanded ? '▼' : '▶'}
                                   </span>
                                 )}
                               </td>
                               <td className="p-3 font-medium text-white">{api}</td>
                               <td className="p-3 text-right text-white/80">{(entry.total_requests ?? 0).toLocaleString()}</td>
                               <td className="p-3 text-right text-white/80">{(entry.success_count ?? 0).toLocaleString()}</td>
                               <td className="p-3 text-right text-white/80">{(entry.failure_count ?? 0).toLocaleString()}</td>
                               <td className="p-3 text-right text-white/80">{(entry.total_tokens ?? 0).toLocaleString()}</td>
                             </tr>
                             
                             {isExpanded && hasModels && (
                               <tr>
                                 <td colSpan={6} className="p-0 bg-white/[0.02]">
                                   <div className="p-4 pl-12">
                                     <table className="w-full text-xs">
                                       <thead className="border-b border-white/10">
                                         <tr>
                                           <th className="p-2 text-left font-medium text-white/70">Model</th>
                                           <th className="p-2 text-right font-medium text-white/70">Requests</th>
                                           <th className="p-2 text-right font-medium text-white/70">Input Tokens</th>
                                           <th className="p-2 text-right font-medium text-white/70">Output Tokens</th>
                                           <th className="p-2 text-right font-medium text-white/70">Total Tokens</th>
                                         </tr>
                                       </thead>
                                       <tbody>
                                         {Object.entries(entry.models!).map(([modelName, modelData]) => {
                                           const model = modelData as ModelSnapshot;
                                           return (
                                             <tr key={modelName} className="border-b border-white/5 last:border-0">
                                               <td className="p-2 text-left text-white/80 font-mono text-[11px]">{modelName}</td>
                                               <td className="p-2 text-right text-white/70">{(model.total_requests ?? 0).toLocaleString()}</td>
                                               <td className="p-2 text-right text-white/70">{(model.input_tokens ?? 0).toLocaleString()}</td>
                                               <td className="p-2 text-right text-white/70">{(model.output_tokens ?? 0).toLocaleString()}</td>
                                               <td className="p-2 text-right text-white/70">{(model.total_tokens ?? 0).toLocaleString()}</td>
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
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
