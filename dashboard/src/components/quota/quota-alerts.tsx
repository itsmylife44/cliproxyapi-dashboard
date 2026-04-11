"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { useAuth } from "@/hooks/use-auth";

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
  { key: "gemini-cli", label: "Gemini CLI" },
  { key: "gemini", label: "Gemini" },
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

export function QuotaAlerts() {
  const { showToast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
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
    if (authLoading) return;
    if (!isAdmin) {
      setLoaded(true);
      return;
    }

    const init = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.ADMIN.TELEGRAM);
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
      } finally {
        setLoaded(true);
      }
    };
    init();
  }, [isAdmin, authLoading]);

  if (authLoading || !loaded || !isAdmin) return null;

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
      if (settings.botToken && !settings.botToken.startsWith("*")) {
        body.botToken = settings.botToken;
      }
      const res = await fetch(API_ENDPOINTS.ADMIN.TELEGRAM, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        showToast("Telegram settings saved", "success");
        const refreshRes = await fetch(API_ENDPOINTS.ADMIN.TELEGRAM);
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
      const res = await fetch(API_ENDPOINTS.ADMIN.TELEGRAM, {
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
      const res = await fetch(API_ENDPOINTS.QUOTA.CHECK_ALERTS, {
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
    <section className="space-y-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">Telegram Alerts</h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">Get notified when quota drops below a threshold.</p>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            onClick={() => setSettings((s) => ({ ...s, enabled: !s.enabled }))}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
              settings.enabled
                ? "bg-blue-500 border-blue-500"
                : "bg-[var(--surface-muted)] border-[var(--surface-border)]"
            )}
          >
            <span
              className={cn(
                "inline-block h-3.5 w-3.5 rounded-full bg-[var(--surface-base)] transition-transform",
                settings.enabled ? "translate-x-4" : "translate-x-0.5"
              )}
            />
          </button>
            <span className="text-xs text-[var(--text-secondary)]">Enable alerts</span>
        </label>

        <div className="space-y-1">
          <label htmlFor="tg-bot-token" className="text-xs font-medium text-[var(--text-muted)]">Bot Token</label>
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
          <p className="text-[10px] text-[var(--text-muted)]">Create a bot via @BotFather on Telegram</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="tg-chat-id" className="text-xs font-medium text-[var(--text-muted)]">Chat ID</label>
          <Input
            name="tg-chat-id"
            value={settings.chatId}
            onChange={(v) => setSettings((s) => ({ ...s, chatId: v }))}
            placeholder="-1001234567890"
          />
          <p className="text-[10px] text-[var(--text-muted)]">Your Telegram user/group ID. Use @userinfobot to find it</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="tg-threshold" className="text-xs font-medium text-[var(--text-muted)]">Threshold %</label>
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
          <p className="text-[10px] text-[var(--text-muted)]">Alert when any account drops below this capacity</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="tg-check-interval" className="text-xs font-medium text-[var(--text-muted)]">Check Interval (minutes)</label>
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
          <p className="text-[10px] text-[var(--text-muted)]">How often to check quota levels (1-1440 min, default: 5)</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="tg-cooldown" className="text-xs font-medium text-[var(--text-muted)]">Cooldown (minutes)</label>
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
          <p className="text-[10px] text-[var(--text-muted)]">Minimum time between notifications (1-1440 min, default: 60)</p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[var(--text-muted)]">Monitored Providers</p>
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
                    className="size-3.5 rounded border-[var(--surface-border)] bg-[var(--surface-muted)] text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0"
                  />
                  <span className="text-xs text-[var(--text-secondary)]">{provider.label}</span>
                </label>
              );
            })}
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">Only selected providers will trigger alerts</p>
        </div>

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

        {checkResult && checkResult.accounts && checkResult.accounts.length > 0 && (
          <div className="mt-2 space-y-1 rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Check Result — {checkResult.breachedCount ?? 0} account(s) breached
            </p>
            <div className="space-y-0.5">
              {checkResult.accounts.map((a) => (
                <div
                  key={`${a.provider}-${a.account}-${a.window}`}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-[var(--text-secondary)]">
                    {a.provider} / {a.account} / {a.window}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      a.belowThreshold ? "text-rose-600" : "text-emerald-700"
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
