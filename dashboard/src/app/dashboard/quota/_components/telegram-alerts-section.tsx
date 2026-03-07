"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { TelegramSettings, CheckAlertResult } from "./quota-types";
import { ALERT_PROVIDERS } from "./quota-types";

const DEFAULT_THRESHOLD = 20;
const DEFAULT_CHECK_INTERVAL = 5;
const DEFAULT_COOLDOWN = 60;
const MIN_INTERVAL = 1;
const MAX_INTERVAL = 1440;

function parseSettings(data: Record<string, unknown>): TelegramSettings {
  return {
    botToken: (data.botToken as string) ?? "",
    chatId: (data.chatId as string) ?? "",
    threshold: (data.threshold as number) ?? DEFAULT_THRESHOLD,
    enabled: (data.enabled as boolean) ?? false,
    providers: Array.isArray(data.providers) ? data.providers : ALERT_PROVIDERS.map((p) => p.key),
    checkInterval: (data.checkInterval as number) ?? DEFAULT_CHECK_INTERVAL,
    cooldown: (data.cooldown as number) ?? DEFAULT_COOLDOWN,
  };
}

export function TelegramAlertsSection() {
  const { showToast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState<TelegramSettings>({
    botToken: "",
    chatId: "",
    threshold: DEFAULT_THRESHOLD,
    enabled: false,
    providers: ALERT_PROVIDERS.map((p) => p.key),
    checkInterval: DEFAULT_CHECK_INTERVAL,
    cooldown: DEFAULT_COOLDOWN,
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
          setSettings(parseSettings(data));
        }
      } catch {
        // non-admin users won't see the section
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
        const refreshRes = await fetch("/api/admin/telegram");
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          setSettings(parseSettings(refreshData));
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

  const handleNumericChange = (field: "threshold" | "checkInterval" | "cooldown", raw: string) => {
    const num = parseInt(raw, 10);
    if (raw === "") {
      setSettings((s) => ({ ...s, [field]: MIN_INTERVAL }));
    } else if (!Number.isNaN(num) && num >= MIN_INTERVAL && num <= (field === "threshold" ? 100 : MAX_INTERVAL)) {
      setSettings((s) => ({ ...s, [field]: num }));
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-slate-100">Telegram Alerts</h2>
        <p className="mt-0.5 text-xs text-slate-400">Get notified when quota drops below a threshold.</p>
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
              settings.enabled ? "bg-blue-500/60 border-blue-400/50" : "bg-slate-700/60 border-slate-600/50"
            )}
          >
            <span className={cn("inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform", settings.enabled ? "translate-x-4" : "translate-x-0.5")} />
          </button>
          <span className="text-xs text-slate-300">Enable alerts</span>
        </label>

        <div className="space-y-1">
          <label htmlFor="tg-bot-token" className="text-xs font-medium text-slate-400">Bot Token</label>
          <div className="flex gap-2">
            <Input type={showToken ? "text" : "password"} name="tg-bot-token" value={settings.botToken} onChange={(v) => setSettings((s) => ({ ...s, botToken: v }))} placeholder="123456789:ABCdef..." autoComplete="off" />
            <Button variant="ghost" onClick={() => setShowToken((v) => !v)} className="shrink-0 px-2 text-xs">{showToken ? "Hide" : "Show"}</Button>
          </div>
          <p className="text-[10px] text-slate-500">Create a bot via @BotFather on Telegram</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="tg-chat-id" className="text-xs font-medium text-slate-400">Chat ID</label>
          <Input name="tg-chat-id" value={settings.chatId} onChange={(v) => setSettings((s) => ({ ...s, chatId: v }))} placeholder="-1001234567890" />
          <p className="text-[10px] text-slate-500">Your Telegram user/group ID. Use @userinfobot to find it</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="tg-threshold" className="text-xs font-medium text-slate-400">Threshold %</label>
          <Input type="number" name="tg-threshold" value={String(settings.threshold)} onChange={(v) => handleNumericChange("threshold", v)} placeholder="20" />
          <p className="text-[10px] text-slate-500">Alert when any account drops below this capacity</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="tg-check-interval" className="text-xs font-medium text-slate-400">Check Interval (minutes)</label>
          <Input type="number" name="tg-check-interval" value={String(settings.checkInterval)} onChange={(v) => handleNumericChange("checkInterval", v)} placeholder="5" />
          <p className="text-[10px] text-slate-500">How often to check quota levels (1-1440 min, default: 5)</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="tg-cooldown" className="text-xs font-medium text-slate-400">Cooldown (minutes)</label>
          <Input type="number" name="tg-cooldown" value={String(settings.cooldown)} onChange={(v) => handleNumericChange("cooldown", v)} placeholder="60" />
          <p className="text-[10px] text-slate-500">Minimum time between notifications (1-1440 min, default: 60)</p>
        </div>

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

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={handleSave} disabled={saving} className="text-xs">{saving ? "Saving..." : "Save"}</Button>
          <Button variant="secondary" onClick={handleTest} disabled={testing || !hasSavedConfig} className="text-xs">{testing ? "Sending..." : "Send Test"}</Button>
          <Button variant="secondary" onClick={handleCheckNow} disabled={checking || !hasSavedConfig} className="text-xs">{checking ? "Checking..." : "Check Now"}</Button>
        </div>

        {checkResult && checkResult.accounts && checkResult.accounts.length > 0 && (
          <div className="mt-2 space-y-1 rounded-md border border-slate-700/70 bg-slate-900/25 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Check Result — {checkResult.breachedCount ?? 0} account(s) breached
            </p>
            <div className="space-y-0.5">
              {checkResult.accounts.map((a) => (
                <div key={`${a.provider}-${a.account}-${a.window}`} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{a.provider} / {a.account} / {a.window}</span>
                  <span className={cn("font-medium", a.belowThreshold ? "text-rose-300" : "text-emerald-300")}>{a.capacity}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
