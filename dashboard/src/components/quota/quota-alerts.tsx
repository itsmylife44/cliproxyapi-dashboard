"use client";

import { useTranslations } from "next-intl";
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
  channel: "disabled" | "telegram" | "discord";
  webhook: string;
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

const ALERT_PROVIDER_LABEL_KEYS: Record<string, string> = {
  "claude": "providerClaude",
  "antigravity": "providerAntigravity",
  "gemini-cli": "providerGeminiCli",
  "gemini": "providerGemini",
  "codex": "providerCodex",
  "github-copilot": "providerCopilot",
  "kimi": "providerKimi",
};

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
    channel: "disabled",
    webhook: "",
    providers: ALERT_PROVIDERS.map((p) => p.key),
    checkInterval: 5,
    cooldown: 60,
  });
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckAlertResult | null>(null);

  const t = useTranslations("quotaAlerts");

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
            channel: data.channel ?? "disabled",
            webhook: data.webhook ?? "",
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
        enabled: settings.channel !== "disabled",
        channel: settings.channel,
        webhook: settings.webhook,
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
        showToast(t("toastSettingsSaved"), "success");
        const refreshRes = await fetch(API_ENDPOINTS.ADMIN.TELEGRAM);
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          setSettings({
            botToken: refreshData.botToken ?? "",
            chatId: refreshData.chatId ?? "",
            threshold: refreshData.threshold ?? 20,
            enabled: refreshData.enabled ?? false,
            channel: refreshData.channel ?? "disabled",
            webhook: refreshData.webhook ?? "",
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
      showToast(t("toastFailedToSave"), "error");
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
        showToast(t("toastTestSent"), "success");
      } else {
        const errData = await res.json();
        const msg = errData?.error?.message ?? errData?.error ?? "Test failed";
        showToast(msg, "error");
      }
    } catch {
      showToast(t("toastTestFailed"), "error");
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
        showToast(t("toastCheckSkipped", { reason: data.reason }), "info");
      } else if (data.breachedCount > 0) {
        showToast(t("toastAlertSent", { count: data.breachedCount }), "success");
      } else {
        showToast(t("toastAllAboveThreshold"), "success");
      }
    } catch {
      showToast(t("toastCheckFailed"), "error");
    } finally {
      setChecking(false);
    }
  };

  const hasSavedConfig = settings.channel === "discord" ? settings.webhook.length > 0 : settings.channel === "telegram" && settings.botToken.length > 0 && settings.chatId.length > 0;

  return (
    <section className="space-y-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">{t("sectionTitle")}</h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t("sectionDescription")}</p>
      </div>

      <div className="space-y-3">
        <div role="tablist" className="flex gap-1 rounded-md bg-[var(--surface-muted)] p-1">
          {(["disabled", "telegram", "discord"] as const).map((channel) => <button key={channel} type="button" role="tab" aria-selected={settings.channel === channel} onClick={() => setSettings((s) => ({ ...s, channel }))} className={cn("flex-1 rounded px-3 py-1.5 text-xs", settings.channel === channel ? "bg-[var(--surface-base)] font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)]")}>{t(channel)}</button>)}
        </div>
        {settings.channel === "discord" && <div className="space-y-1"><label htmlFor="discord-webhook" className="text-xs font-medium text-[var(--text-muted)]">{t("webhookUrl")}</label><Input type="password" name="discord-webhook" value={settings.webhook} onChange={(v) => setSettings((s) => ({ ...s, webhook: v }))} autoComplete="off" /></div>}
        {settings.channel === "telegram" && <>

        <div className="space-y-1">
          <label htmlFor="tg-bot-token" className="text-xs font-medium text-[var(--text-muted)]">{t("botTokenLabel")}</label>
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
              {showToken ? t("buttonHide") : t("buttonShow")}
            </Button>
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">{t("botTokenHint")}</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="tg-chat-id" className="text-xs font-medium text-[var(--text-muted)]">{t("chatIdLabel")}</label>
          <Input
            name="tg-chat-id"
            value={settings.chatId}
            onChange={(v) => setSettings((s) => ({ ...s, chatId: v }))}
            placeholder="-1001234567890"
          />
          <p className="text-[10px] text-[var(--text-muted)]">{t("chatIdHint")}</p>
        </div>
        </>}

        <div className="space-y-1">
          <label htmlFor="tg-threshold" className="text-xs font-medium text-[var(--text-muted)]">{t("thresholdLabel")}</label>
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
          <p className="text-[10px] text-[var(--text-muted)]">{t("thresholdHint")}</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="tg-check-interval" className="text-xs font-medium text-[var(--text-muted)]">{t("checkIntervalLabel")}</label>
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
          <p className="text-[10px] text-[var(--text-muted)]">{t("checkIntervalHint")}</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="tg-cooldown" className="text-xs font-medium text-[var(--text-muted)]">{t("cooldownLabel")}</label>
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
          <p className="text-[10px] text-[var(--text-muted)]">{t("cooldownHint")}</p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[var(--text-muted)]">{t("monitoredProviders")}</p>
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
                  <span className="text-xs text-[var(--text-secondary)]">{t(ALERT_PROVIDER_LABEL_KEYS[provider.key] as Parameters<typeof t>[0])}</span>
                </label>
              );
            })}
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">{t("monitoredProvidersHint")}</p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={handleSave} disabled={saving} className="text-xs">
            {saving ? t("buttonSaving") : t("buttonSave")}
          </Button>
          <Button
            variant="secondary"
            onClick={handleTest}
            disabled={testing || !hasSavedConfig}
            className="text-xs"
          >
            {testing ? t("buttonSending") : t("buttonSendTest")}
          </Button>
          <Button
            variant="secondary"
            onClick={handleCheckNow}
            disabled={checking || !hasSavedConfig}
            className="text-xs"
          >
            {checking ? t("buttonChecking") : t("buttonCheckNow")}
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
