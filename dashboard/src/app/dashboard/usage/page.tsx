"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

interface ApiEntry {
  total_requests: number;
  success_count: number;
  failure_count: number;
  total_tokens: number;
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
}

async function fetchUsage(params: FetchUsageParams) {
  const { setStats, setLoading, showToast } = params;
  setLoading(true);
  try {
    const res = await fetch("/api/management/usage");
    if (!res.ok) {
      showToast("Failed to load usage statistics", "error");
      setLoading(false);
      return;
    }

    const data = await res.json();
    // Handle both { usage: { ... } } and direct stats object shapes
    const usage = data?.usage ?? data;
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
  const { showToast } = useToast();

  useEffect(() => {
    void fetchUsage({ setStats, setLoading, showToast });
  }, [showToast]);

   return (
     <div className="space-y-4">
       <div className="flex items-center justify-between">
         <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg">
           Usage Statistics
         </h1>
        <Button
          onClick={() => fetchUsage({ setStats, setLoading, showToast })}
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

           {(stats.total_tokens ?? 0) > 0 && (
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
          )}

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
                        <th className="p-3 text-left font-medium text-white/90">API</th>
                        <th className="p-3 text-right font-medium text-white/90">Total</th>
                        <th className="p-3 text-right font-medium text-white/90">Success</th>
                        <th className="p-3 text-right font-medium text-white/90">Failed</th>
                        <th className="p-3 text-right font-medium text-white/90">Tokens</th>
                      </tr>
                    </thead>
                    <tbody>
                       {Object.entries(stats.apis).map(([api, data]) => {
                         const entry = (data && typeof data === "object" ? data : {}) as Partial<ApiEntry>;
                         return (
                           <tr key={api} className="border-b border-white/10">
                             <td className="p-3 font-medium text-white">{api}</td>
                             <td className="p-3 text-right text-white/80">{(entry.total_requests ?? 0).toLocaleString()}</td>
                             <td className="p-3 text-right text-white/80">{(entry.success_count ?? 0).toLocaleString()}</td>
                             <td className="p-3 text-right text-white/80">{(entry.failure_count ?? 0).toLocaleString()}</td>
                             <td className="p-3 text-right text-white/80">{(entry.total_tokens ?? 0).toLocaleString()}</td>
                           </tr>
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
