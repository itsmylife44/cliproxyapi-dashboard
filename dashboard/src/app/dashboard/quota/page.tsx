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
            <div className="py-12 text-center text-sm text-white/60">
              Loading quota data...
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <div className="backdrop-blur-2xl glass-card rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-400 text-lg" aria-hidden="true">&#9679;</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white/50 uppercase tracking-wider">Active Accounts</div>
                  <div className="text-2xl font-bold text-white mt-0.5">{activeAccounts}</div>
                  <div className="text-xs text-white/60 mt-0.5">Supported OAuth</div>
                </div>
              </div>
            </div>

            <div className="backdrop-blur-2xl glass-card rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-400 text-lg" aria-hidden="true">&#9650;</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white/50 uppercase tracking-wider">Average Quota</div>
                  <div className="text-2xl font-bold text-white mt-0.5">
                    {Math.round(avgQuota * 100)}%
                  </div>
                  <div className="text-xs text-white/60 mt-0.5">Remaining capacity</div>
                </div>
              </div>
            </div>

            <div className="backdrop-blur-2xl glass-card rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)] sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-400/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-red-400 text-lg" aria-hidden="true">&#9888;</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white/50 uppercase tracking-wider">Low Quota</div>
                  <div className="text-2xl font-bold text-white mt-0.5">{lowQuotaCount}</div>
                  <div className="text-xs text-white/60 mt-0.5">Groups below 20%</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {filteredAccounts.map((account) => {
              const statusBadge = account.supported
                ? account.error
                  ? { label: "ERROR", class: "bg-red-500/20 border-red-400/40 text-red-300" }
                  : { label: "ACTIVE", class: "bg-emerald-500/20 border-emerald-400/40 text-emerald-300" }
                : { label: "NOT SUPPORTED", class: "bg-amber-500/20 border-amber-400/40 text-amber-300" };

              return (
                <Card key={account.auth_index}>
                  <CardContent className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-white capitalize">
                          {account.provider}
                        </h3>
                        <p className="text-sm text-white/60 mt-0.5 truncate">{maskEmail(account.email)}</p>
                      </div>
                      <span
                        className={cn(
                          "backdrop-blur-xl px-2.5 py-1 text-xs font-medium rounded-lg border flex-shrink-0",
                          statusBadge.class
                        )}
                      >
                        {statusBadge.label}
                      </span>
                    </div>

                    {account.error && (
                      <div className="backdrop-blur-xl bg-red-500/10 border border-red-400/30 rounded-lg p-3">
                        <div className="text-sm text-red-200">{account.error}</div>
                      </div>
                    )}

                    {!account.supported && !account.error && (
                      <div className="backdrop-blur-xl bg-amber-500/10 border border-amber-400/30 rounded-lg p-3">
                        <div className="text-sm text-amber-200">
                          Quota monitoring not available for this provider
                        </div>
                      </div>
                    )}

                    {account.groups && account.groups.length > 0 && (
                      <div className="space-y-3">
                        {account.groups.map((group) => {
                          const isExpanded = expandedGroups[`${account.auth_index}-${group.id}`];
                          
                          return (
                            <div key={group.id} className="backdrop-blur-xl bg-white/5 rounded-lg p-3 border border-white/10">
                              <button
                                type="button"
                                className="w-full text-left"
                                onClick={() => toggleGroup(account.auth_index, group.id)}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-semibold text-white">{group.label}</span>
                                  <span className="text-xs font-medium text-white/70">
                                    {Math.round(group.remainingFraction * 100)}%
                                  </span>
                                </div>
                                
                                <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full transition-all duration-300",
                                      getProgressColor(group.remainingFraction)
                                    )}
                                    style={{ width: `${group.remainingFraction * 100}%` }}
                                  />
                                </div>
                                
                                <div className="mt-1.5 text-xs text-white/50">
                                  {formatRelativeTime(group.resetTime)}
                                </div>
                              </button>

                              {isExpanded && group.models.length > 0 && (
                                <div className="mt-3 pt-3 space-y-2.5 border-t border-white/10">
                                  {group.models.map((model) => (
                                    <div key={model.id}>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-white/70 font-medium">{model.displayName}</span>
                                        <span className="text-xs text-white/50">
                                          {Math.round(model.remainingFraction * 100)}%
                                        </span>
                                      </div>
                                      
                                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                                        <div
                                          className={cn(
                                            "h-full transition-all duration-300",
                                            getProgressColor(model.remainingFraction)
                                          )}
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


                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredAccounts.length === 0 && !loading && (
            <Card>
              <CardContent>
                <div className="text-center text-white/60 py-12 text-sm">
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
