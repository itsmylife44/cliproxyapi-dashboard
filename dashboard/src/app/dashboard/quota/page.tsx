"use client";

import { RadialBarChart, RadialBar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartEmpty, CHART_COLORS, TOOLTIP_STYLE, AXIS_TICK_STYLE } from "@/components/ui/chart-theme";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { HelpTooltip } from "@/components/ui/tooltip";

interface QuotaModel {
  id: string;
  displayName: string;
  remainingFraction?: number | null;
  resetTime: string | null;
}

interface QuotaGroup {
  id: string;
  label: string;
  remainingFraction?: number | null;
  resetTime: string | null;
  models: QuotaModel[];
}

interface QuotaAccount {
  auth_index: string;
  provider: string;
  email?: string | null;
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
  COPILOT: "github-copilot",
  KIMI: "kimi",
} as const;

type ProviderType = (typeof PROVIDERS)[keyof typeof PROVIDERS];

function normalizeFraction(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function maskEmail(email: unknown): string {
  if (typeof email !== "string") return "unknown";
  const trimmed = email.trim();
  if (trimmed === "") return "unknown";

  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return trimmed;
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  const maskedLocal = local.length <= 3 ? `${local}***` : `${local.slice(0, 3)}***`;
  return `${maskedLocal}@${domain}`;
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
    const score = normalizeFraction(group.remainingFraction);
    if (score === null) continue;
    result[group.id] = {
      score,
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
      return normalizeFraction(group?.remainingFraction);
    }).filter((score): score is number => score !== null);

    if (scores.length === 0) {
      continue;
    }

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

interface TelegramSettings {
  botToken: string;
  chatId: string;
  threshold: number;
  enabled: boolean;
  providers: string[];
  checkInterval: number;
  cooldown: number;
}

const ALERT_PROVIDERS = [
  { key: "claude", label: "Claude" },
  { key: "antigravity", label: "Antigravity" },
  { key: "codex", label: "Codex" },
  { key: "github-copilot", label: "Copilot" },
  { key: "kimi", label: "Kimi" },
] as const;

interface CheckAlertResult {
  checked?: boolean;
  skipped?: boolean;
  reason?: string;
  alertsSent?: number;
  breachedCount?: number;
  accounts?: Array<{
    provider: string;
    account: string;
    window: string;
    capacity: number;
    belowThreshold: boolean;
  }>;
}

function TelegramAlertsSection() {
  const { showToast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState<TelegramSettings>({
    botToken: "",
    chatId: "",
    threshold: 20,
    enabled: false,
    providers: ALERT_PROVIDERS.map((p) => p.key),
    checkInterval: 5,
    cooldown: 60,
  });
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckAlertResult | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) return;
        const meData = await meRes.json();
        if (!meData.isAdmin) return;
        setIsAdmin(true);

        const res = await fetch("/api/admin/telegram");
        if (res.ok) {
          const data = await res.json();
          setSettings({
            botToken: data.botToken ?? "",
            chatId: data.chatId ?? "",
            threshold: data.threshold ?? 20,
            enabled: data.enabled ?? false,
            providers: Array.isArray(data.providers) ? data.providers : ALERT_PROVIDERS.map((p) => p.key),
            checkInterval: data.checkInterval ?? 5,
            cooldown: data.cooldown ?? 60,
          });
        }
      } catch {
        // silently fail — non-admin users won't see the section
      } finally {
        setLoaded(true);
      }
    };
    init();
  }, []);

  if (!loaded || !isAdmin) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        chatId: settings.chatId,
        threshold: settings.threshold,
        enabled: settings.enabled,
        providers: settings.providers,
        checkInterval: settings.checkInterval,
        cooldown: settings.cooldown,
      };
      // Only send botToken if user changed it (not the masked version)
      if (settings.botToken && !settings.botToken.startsWith("*")) {
        body.botToken = settings.botToken;
      }
      const res = await fetch("/api/admin/telegram", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        showToast("Telegram settings saved", "success");
        // Re-fetch to get masked token
        const refreshRes = await fetch("/api/admin/telegram");
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          setSettings({
            botToken: refreshData.botToken ?? "",
            chatId: refreshData.chatId ?? "",
            threshold: refreshData.threshold ?? 20,
            enabled: refreshData.enabled ?? false,
            providers: Array.isArray(refreshData.providers) ? refreshData.providers : ALERT_PROVIDERS.map((p) => p.key),
            checkInterval: refreshData.checkInterval ?? 5,
            cooldown: refreshData.cooldown ?? 60,
          });
          setShowToken(false);
        }
      } else {
        const errData = await res.json();
        const msg = errData?.error?.message ?? errData?.error ?? "Failed to save";
        showToast(msg, "error");
      }
    } catch {
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        showToast("Test message sent! Check your Telegram.", "success");
      } else {
        const errData = await res.json();
        const msg = errData?.error?.message ?? errData?.error ?? "Test failed";
        showToast(msg, "error");
      }
    } catch {
      showToast("Failed to send test message", "error");
    } finally {
      setTesting(false);
    }
  };

  const handleCheckNow = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await fetch("/api/quota/check-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const msg = errData?.error?.message ?? errData?.error ?? "Check failed";
        showToast(msg, "error");
        return;
      }
      const data = await res.json();
      setCheckResult(data);
      if (data.skipped) {
        showToast(`Check skipped: ${data.reason}`, "info");
      } else if (data.breachedCount > 0) {
        showToast(`Alert sent for ${data.breachedCount} account(s)`, "success");
      } else {
        showToast("All accounts above threshold", "success");
      }
    } catch {
      showToast("Failed to check alerts", "error");
    } finally {
      setChecking(false);
    }
  };

  const hasSavedConfig = settings.botToken.length > 0 && settings.chatId.length > 0;

  return (
    <section className="space-y-3 rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-slate-100">Telegram Alerts</h2>
        <p className="mt-0.5 text-xs text-slate-400">Get notified when quota drops below a threshold.</p>
      </div>

      <div className="space-y-3">
        {/* Enable/Disable toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            onClick={() => setSettings((s) => ({ ...s, enabled: !s.enabled }))}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
              settings.enabled
                ? "bg-blue-500/60 border-blue-400/50"
                : "bg-slate-700/60 border-slate-600/50"
            )}
          >
            <span
              className={cn(
                "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                settings.enabled ? "translate-x-4" : "translate-x-0.5"
              )}
            />
          </button>
          <span className="text-xs text-slate-300">Enable alerts</span>
        </label>

        {/* Bot Token */}
        <div className="space-y-1">
          <label htmlFor="tg-bot-token" className="text-xs font-medium text-slate-400">Bot Token</label>
          <div className="flex gap-2">
            <Input
              type={showToken ? "text" : "password"}
              name="tg-bot-token"
              value={settings.botToken}
              onChange={(v) => setSettings((s) => ({ ...s, botToken: v }))}
              placeholder="123456789:ABCdef..."
              autoComplete="off"
            />
            <Button
              variant="ghost"
              onClick={() => setShowToken((v) => !v)}
              className="shrink-0 px-2 text-xs"
            >
              {showToken ? "Hide" : "Show"}
            </Button>
          </div>
          <p className="text-[10px] text-slate-500">Create a bot via @BotFather on Telegram</p>
        </div>

        {/* Chat ID */}
        <div className="space-y-1">
          <label htmlFor="tg-chat-id" className="text-xs font-medium text-slate-400">Chat ID</label>
          <Input
            name="tg-chat-id"
            value={settings.chatId}
            onChange={(v) => setSettings((s) => ({ ...s, chatId: v }))}
            placeholder="-1001234567890"
          />
          <p className="text-[10px] text-slate-500">Your Telegram user/group ID. Use @userinfobot to find it</p>
        </div>

        {/* Threshold */}
        <div className="space-y-1">
          <label htmlFor="tg-threshold" className="text-xs font-medium text-slate-400">Threshold %</label>
          <Input
            type="number"
            name="tg-threshold"
            value={String(settings.threshold)}
            onChange={(v) => {
              const num = parseInt(v, 10);
              if (!Number.isNaN(num) && num >= 1 && num <= 100) {
                setSettings((s) => ({ ...s, threshold: num }));
              } else if (v === "") {
                setSettings((s) => ({ ...s, threshold: 1 }));
              }
            }}
            placeholder="20"
          />
          <p className="text-[10px] text-slate-500">Alert when any account drops below this capacity</p>
        </div>

        {/* Check Interval */}
        <div className="space-y-1">
          <label htmlFor="tg-check-interval" className="text-xs font-medium text-slate-400">Check Interval (minutes)</label>
          <Input
            type="number"
            name="tg-check-interval"
            value={String(settings.checkInterval)}
            onChange={(v) => {
              const num = parseInt(v, 10);
              if (!Number.isNaN(num) && num >= 1 && num <= 1440) {
                setSettings((s) => ({ ...s, checkInterval: num }));
              } else if (v === "") {
                setSettings((s) => ({ ...s, checkInterval: 1 }));
              }
            }}
            placeholder="5"
          />
          <p className="text-[10px] text-slate-500">How often to check quota levels (1–1440 min, default: 5)</p>
        </div>

        {/* Cooldown */}
        <div className="space-y-1">
          <label htmlFor="tg-cooldown" className="text-xs font-medium text-slate-400">Cooldown (minutes)</label>
          <Input
            type="number"
            name="tg-cooldown"
            value={String(settings.cooldown)}
            onChange={(v) => {
              const num = parseInt(v, 10);
              if (!Number.isNaN(num) && num >= 1 && num <= 1440) {
                setSettings((s) => ({ ...s, cooldown: num }));
              } else if (v === "") {
                setSettings((s) => ({ ...s, cooldown: 1 }));
              }
            }}
            placeholder="60"
          />
          <p className="text-[10px] text-slate-500">Minimum time between notifications (1–1440 min, default: 60)</p>
        </div>

        {/* Provider selection */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-400">Monitored Providers</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {ALERT_PROVIDERS.map((provider) => {
              const isChecked = settings.providers.includes(provider.key);
              return (
                <label key={provider.key} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      setSettings((s) => ({
                        ...s,
                        providers: isChecked
                          ? s.providers.filter((p) => p !== provider.key)
                          : [...s.providers, provider.key],
                      }));
                    }}
                    className="size-3.5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0"
                  />
                  <span className="text-xs text-slate-300">{provider.label}</span>
                </label>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-500">Only selected providers will trigger alerts</p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={handleSave} disabled={saving} className="text-xs">
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="secondary"
            onClick={handleTest}
            disabled={testing || !hasSavedConfig}
            className="text-xs"
          >
            {testing ? "Sending..." : "Send Test"}
          </Button>
          <Button
            variant="secondary"
            onClick={handleCheckNow}
            disabled={checking || !hasSavedConfig}
            className="text-xs"
          >
            {checking ? "Checking..." : "Check Now"}
          </Button>
        </div>

        {/* Check result */}
        {checkResult && checkResult.accounts && checkResult.accounts.length > 0 && (
          <div className="mt-2 space-y-1 rounded-md border border-slate-700/70 bg-slate-900/25 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Check Result — {checkResult.breachedCount ?? 0} account(s) breached
            </p>
            <div className="space-y-0.5">
              {checkResult.accounts.map((a) => (
                <div
                  key={`${a.provider}-${a.account}-${a.window}`}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-slate-300">
                    {a.provider} / {a.account} / {a.window}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      a.belowThreshold ? "text-rose-300" : "text-emerald-300"
                    )}
                  >
                    {a.capacity}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
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
        }
      } catch {
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
    if (selectedProvider === PROVIDERS.COPILOT) {
      return account.provider === "github" || account.provider === "github-copilot";
    }
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
    { key: PROVIDERS.COPILOT, label: "Copilot" },
    { key: PROVIDERS.KIMI, label: "Kimi" },
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
      }
    } catch {
    } finally {
      setLoading(false);
    }
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
              {providerFilters.map((filter) => (
                <Button
                  key={filter.key}
                  variant={selectedProvider === filter.key ? "secondary" : "ghost"}
                  onClick={() => {
                    setSelectedProvider(filter.key);
                    if (filter.key !== PROVIDERS.ALL) {
                      setTimeout(() => {
                        document.getElementById("quota-accounts")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }, 50);
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

          {/* Charts: Capacity Gauge + Provider Comparison */}
          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* Radial Gauge: Overall Capacity */}
            <ChartContainer title="Overall Capacity" subtitle="Weighted across all providers">
              {providerSummaries.length === 0 ? (
                <ChartEmpty message="No provider data" />
              ) : (() => {
                const pct = Math.round(overallCapacity.value * 100);
                const gaugeColor =
                  overallCapacity.value > 0.6
                    ? CHART_COLORS.success
                    : overallCapacity.value > 0.2
                    ? CHART_COLORS.warning
                    : CHART_COLORS.danger;
                const gaugeData = [{ value: pct, fill: gaugeColor }];
                return (
                  <div className="relative flex h-48 items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart
                        cx="50%"
                        cy="60%"
                        innerRadius="55%"
                        outerRadius="80%"
                        startAngle={210}
                        endAngle={-30}
                        data={[{ value: 100, fill: "rgba(148,163,184,0.1)" }, ...gaugeData]}
                        barSize={14}
                      >
                        <RadialBar dataKey="value" background={false} cornerRadius={4} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold" style={{ color: gaugeColor }}>{pct}%</span>
                      <span className="mt-0.5 text-[10px] uppercase tracking-widest" style={{ color: CHART_COLORS.text.dimmed }}>Capacity</span>
                    </div>
                  </div>
                );
              })()}
            </ChartContainer>

            {/* Horizontal BarChart: Provider long-term capacity */}
            <ChartContainer title="Provider Capacity" subtitle="Long-term window minimum per provider">
              {providerSummaries.length === 0 ? (
                <ChartEmpty message="No provider data" />
              ) : (() => {
                const barData = providerSummaries.map((s) => {
                  const longTerm = s.windowCapacities.filter((w) => !w.isShortTerm);
                  const shortTerm = s.windowCapacities.filter((w) => w.isShortTerm);
                  const relevant = longTerm.length > 0 ? longTerm : shortTerm;
                  const cap = relevant.length > 0 ? Math.min(...relevant.map((w) => w.capacity)) : 0;
                  return { provider: s.provider, capacity: Math.round(cap * 100) };
                });
                return (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={barData}
                        layout="vertical"
                        margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
                        barSize={10}
                      >
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          tick={AXIS_TICK_STYLE}
                          tickLine={false}
                          axisLine={{ stroke: CHART_COLORS.border }}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <YAxis
                          type="category"
                          dataKey="provider"
                          tick={{ ...AXIS_TICK_STYLE, fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          width={72}
                        />
                        <Tooltip
                          {...TOOLTIP_STYLE}
                          formatter={(value) => [`${value}%`, "Capacity"]}
                        />
                        <Bar dataKey="capacity" radius={[0, 3, 3, 0]}>
                          {barData.map((entry, index) => {
                            const v = entry.capacity / 100;
                            const color =
                              v > 0.6
                                ? CHART_COLORS.success
                                : v > 0.2
                                ? CHART_COLORS.warning
                                : CHART_COLORS.danger;
                            return <Cell key={`cell-${index}`} fill={color} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </ChartContainer>
          </section>

          {providerSummaries.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Provider Capacity</h2>
              <div className="overflow-x-auto rounded-md border border-slate-700/70 bg-slate-900/25">
                <div className="min-w-[600px]">
                <div className="grid grid-cols-[minmax(0,1fr)_160px_160px_120px_100px] border-b border-slate-700/70 bg-slate-900/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  <span>Provider</span>
                  <span>Long-Term <HelpTooltip content="Quota remaining in the longer reset window (e.g., daily or weekly limit)" /></span>
                  <span>Short-Term <HelpTooltip content="Quota remaining in the shorter reset window (e.g., per-minute or per-hour limit)" /></span>
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
              </div>
            </section>
          )}

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
                            <p className="mb-2 break-all text-xs text-rose-300">{account.error}</p>
                          )}
                          {!account.supported && !account.error && (
                            <p className="mb-2 text-xs text-amber-300">Quota monitoring not available for this provider.</p>
                          )}

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
                })}
              </div>
              </div>

            {filteredAccounts.length === 0 && !loading && (
              <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-6 text-center text-sm text-slate-400">
                No accounts found for the selected filter.
              </div>
            )}
          </section>
        </>
      )}

      <TelegramAlertsSection />

    </div>
  );
}
