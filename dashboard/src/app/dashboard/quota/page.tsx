"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
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

export default function QuotaPage() {
  const [quotaData, setQuotaData] = useState<QuotaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>(PROVIDERS.ALL);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

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
  
  const allGroups = quotaData?.accounts.flatMap((account) => account.groups || []) || [];
  const avgQuota = allGroups.length > 0
    ? allGroups.reduce((sum, group) => sum + group.remainingFraction, 0) / allGroups.length
    : 0;
  
  const lowQuotaCount = allGroups.filter((group) => group.remainingFraction < 0.2).length;

  const toggleGroup = (accountId: string, groupId: string) => {
    const key = `${accountId}-${groupId}`;
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg">
          Quota
        </h1>
        
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedProvider === PROVIDERS.ALL ? "secondary" : "ghost"}
              onClick={() => setSelectedProvider(PROVIDERS.ALL)}
              className="text-xs px-3 py-1"
            >
              All
            </Button>
            <Button
              variant={selectedProvider === PROVIDERS.ANTIGRAVITY ? "secondary" : "ghost"}
              onClick={() => setSelectedProvider(PROVIDERS.ANTIGRAVITY)}
              className="text-xs px-3 py-1"
            >
              Antigravity
            </Button>
            <Button
              variant={selectedProvider === PROVIDERS.CLAUDE ? "secondary" : "ghost"}
              onClick={() => setSelectedProvider(PROVIDERS.CLAUDE)}
              className="text-xs px-3 py-1"
            >
              Claude
            </Button>
            <Button
              variant={selectedProvider === PROVIDERS.CODEX ? "secondary" : "ghost"}
              onClick={() => setSelectedProvider(PROVIDERS.CODEX)}
              className="text-xs px-3 py-1"
            >
              Codex
            </Button>
          </div>
          
          <Button
            onClick={fetchQuota}
            disabled={loading}
            className="text-xs px-3 py-1"
          >
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      {loading && !quotaData ? (
        <div className="text-sm text-white/60">Loading quota data...</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Active Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-l-4 border-purple-400/60 p-4 backdrop-blur-xl bg-white/5 rounded-r-xl">
                  <div className="text-3xl font-bold text-white">{activeAccounts}</div>
                  <div className="mt-1 text-xs font-medium text-white/70">
                    Supported OAuth accounts
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Average Quota</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-l-4 border-emerald-400/60 p-4 backdrop-blur-xl bg-white/5 rounded-r-xl">
                  <div className="text-3xl font-bold text-white">
                    {Math.round(avgQuota * 100)}%
                  </div>
                  <div className="mt-1 text-xs font-medium text-white/70">
                    Average remaining quota
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Low Quota</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-l-4 border-red-400/60 p-4 backdrop-blur-xl bg-white/5 rounded-r-xl">
                  <div className="text-3xl font-bold text-white">{lowQuotaCount}</div>
                  <div className="mt-1 text-xs font-medium text-white/70">
                    Groups below 20%
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {filteredAccounts.map((account) => {
              const statusBadge = account.supported
                ? account.error
                  ? { label: "ERROR", class: "bg-red-500/30 border-red-400/40" }
                  : { label: "ACTIVE", class: "bg-emerald-500/30 border-emerald-400/40" }
                : { label: "NOT SUPPORTED", class: "bg-amber-500/30 border-amber-400/40" };

              return (
                <Card key={account.auth_index}>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-white capitalize">
                            {account.provider}
                          </h3>
                          <p className="text-sm text-white/60">{maskEmail(account.email)}</p>
                        </div>
                        <span
                          className={cn(
                            "backdrop-blur-xl px-3 py-1 text-xs font-medium text-white rounded-lg border",
                            statusBadge.class
                          )}
                        >
                          {statusBadge.label}
                        </span>
                      </div>

                      {account.error && (
                        <div className="border-l-4 border-red-400/60 backdrop-blur-xl bg-red-500/20 p-4 text-sm text-white rounded-r-xl">
                          {account.error}
                        </div>
                      )}

                      {!account.supported && !account.error && (
                        <div className="border-l-4 border-amber-400/60 backdrop-blur-xl bg-amber-500/20 p-4 text-sm text-white rounded-r-xl">
                          Quota monitoring not available for this provider
                        </div>
                      )}

                      {account.groups && account.groups.length > 0 && (
                        <div className="space-y-3">
                          {account.groups.map((group) => {
                            const isExpanded = expandedGroups[`${account.auth_index}-${group.id}`];
                            
                            return (
                              <div key={group.id} className="space-y-2">
                                <button
                                  type="button"
                                  className="w-full cursor-pointer select-none text-left"
                                  onClick={() => toggleGroup(account.auth_index, group.id)}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-bold text-white">{group.label}</span>
                                    <span className="text-sm text-white/80">
                                      {Math.round(group.remainingFraction * 100)}% remaining
                                    </span>
                                  </div>
                                  
                                  <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                      className={cn("h-full transition-all duration-300", getProgressColor(group.remainingFraction))}
                                      style={{ width: `${group.remainingFraction * 100}%` }}
                                    />
                                  </div>
                                  
                                  <div className="mt-1 text-xs text-white/60">
                                    {formatRelativeTime(group.resetTime)}
                                  </div>
                                </button>

                                {isExpanded && group.models.length > 0 && (
                                  <div className="ml-4 space-y-2 pt-2 border-l-2 border-white/10 pl-3">
                                    {group.models.map((model) => (
                                      <div key={model.id} className="space-y-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-white/80">{model.displayName}</span>
                                          <span className="text-xs text-white/60">
                                            {Math.round(model.remainingFraction * 100)}%
                                          </span>
                                        </div>
                                        
                                        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                                          <div
                                            className={cn("h-full transition-all duration-300", getProgressColor(model.remainingFraction))}
                                            style={{ width: `${model.remainingFraction * 100}%` }}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {account.raw && account.provider === "codex" ? (
                        <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-lg p-3 font-mono text-xs text-white/80 overflow-auto max-h-48">
                          <pre>{JSON.stringify(account.raw, null, 2)}</pre>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredAccounts.length === 0 && !loading && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-white/60 py-8">
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
