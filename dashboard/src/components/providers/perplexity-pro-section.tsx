"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { useTranslations } from "next-intl";

type ShowToast = ReturnType<typeof useToast>["showToast"];

interface PerplexityProSectionProps {
  showToast: ShowToast;
}

interface PerplexityCookie {
  id: string;
  label: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function PerplexityProSection({ showToast }: PerplexityProSectionProps) {
  const t = useTranslations("providers");
  const [perplexityCookies, setPerplexityCookies] = useState<PerplexityCookie[]>([]);
  const [perplexityCookiesLoading, setPerplexityCookiesLoading] = useState(true);
  const [perplexityEnabled, setPerplexityEnabled] = useState<boolean | null>(null);
  const [perplexitySessionToken, setPerplexitySessionToken] = useState("");
  const [perplexityCsrfToken, setPerplexityCsrfToken] = useState("");
  const [perplexityCookieLabel, setPerplexityCookieLabel] = useState("");
  const [perplexityCookieSaving, setPerplexityCookieSaving] = useState(false);
  const [showPerplexitySessionToken, setShowPerplexitySessionToken] = useState(false);
  const [showPerplexityCsrfToken, setShowPerplexityCsrfToken] = useState(false);
  const [perplexityModelSyncing, setPerplexityModelSyncing] = useState(false);

  const loadPerplexityCookies = useCallback(async () => {
    setPerplexityCookiesLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.PROVIDERS.PERPLEXITY_COOKIE);
      if (!res.ok) {
        showToast(t("toastPerplexityLoadFailed"), "error");
        setPerplexityCookiesLoading(false);
        return;
      }
      const data = await res.json();
      // Check if the feature is enabled server-side
      if (data.enabled === false) {
        setPerplexityEnabled(false);
        setPerplexityCookiesLoading(false);
        return;
      }
      setPerplexityEnabled(true);
      setPerplexityCookies(Array.isArray(data.cookies) ? data.cookies : []);
    } catch {
      showToast(t("toastNetworkError"), "error");
    } finally {
      setPerplexityCookiesLoading(false);
    }
  }, [showToast, t]);

  const handlePerplexityCookieSave = async () => {
    const sessionToken = perplexitySessionToken.trim();
    if (!sessionToken) {
      showToast(t("toastApiKeyRequired"), "error");
      return;
    }
    const csrfToken = perplexityCsrfToken.trim();
    const cookieObj: Record<string, string> = { "next-auth.session-token": sessionToken };
    if (csrfToken) {
      cookieObj["next-auth.csrf-token"] = csrfToken;
    }
    const cookieData = JSON.stringify(cookieObj);
    setPerplexityCookieSaving(true);
    try {
      const res = await fetch(API_ENDPOINTS.PROVIDERS.PERPLEXITY_COOKIE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookieData,
          label: perplexityCookieLabel.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error?.message ?? data.error ?? t("toastPerplexityCookieSaveFailed"), "error");
        return;
      }
      if (data.providerProvisioned) {
        showToast(t("toastPerplexitySavedProvisioned"), "success");
      } else {
        showToast(t("toastPerplexitySaved"), "success");
      }
      setPerplexitySessionToken("");
      setPerplexityCsrfToken("");
      setPerplexityCookieLabel("");
      void loadPerplexityCookies();
    } catch {
      showToast(t("toastNetworkError"), "error");
    } finally {
      setPerplexityCookieSaving(false);
    }
  };

  const handlePerplexityModelSync = async () => {
    setPerplexityModelSyncing(true);
    try {
      const res = await fetch(API_ENDPOINTS.PROVIDERS.PERPLEXITY_COOKIE_SYNC_MODELS, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error?.message ?? data.error ?? t("toastPerplexityModelSyncFailed"), "error");
        return;
      }
      if (data.created) {
        showToast(t("toastPerplexityProviderCreated", { count: data.modelCount }), "success");
      } else if (data.added?.length > 0 || data.removed?.length > 0) {
        const parts: string[] = [];
        if (data.added?.length > 0) parts.push(`${data.added.length} added`);
        if (data.removed?.length > 0) parts.push(`${data.removed.length} removed`);
        showToast(t("toastPerplexityModelsSynced", { parts: parts.join(", ") }), "success");
      } else {
        showToast(t("toastPerplexityModelsUpToDate"), "success");
      }
    } catch {
      showToast(t("toastNetworkError"), "error");
    } finally {
      setPerplexityModelSyncing(false);
    }
  };

  const handlePerplexityCookieDelete = async (id: string) => {
    try {
      const res = await fetch(API_ENDPOINTS.PROVIDERS.PERPLEXITY_COOKIE, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error?.message ?? data.error ?? t("toastPerplexityCookieDeleteFailed"), "error");
        return;
      }
      showToast(t("toastPerplexityCookieRemoved"), "success");
      void loadPerplexityCookies();
    } catch {
      showToast(t("toastNetworkError"), "error");
    }
  };

  useEffect(() => {
    void loadPerplexityCookies();
  }, [loadPerplexityCookies]);

  // Hide entire section if the Perplexity Sidecar feature is not enabled
  // (PERPLEXITY_SIDECAR_SECRET not configured on server)
  if (perplexityEnabled === false) return null;

  // Still loading initial state — show nothing to avoid flash
  if (perplexityEnabled === null && perplexityCookiesLoading) return null;

  return (
    <div className="border-t border-[var(--surface-border)] pt-6">
    <div id="provider-perplexity" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Perplexity Pro</h2>
          <p className="text-xs text-[var(--text-muted)]">Browser session cookies for Perplexity Pro access</p>
        </div>
        <span className="text-xs font-medium text-[var(--text-muted)]">{perplexityCookies.length} configured</span>
      </div>

      <div className="space-y-3">
        <div className="rounded-sm border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700">
          <strong className="text-amber-800">How to get your cookies:</strong>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4">
            <li>{t("perplexityStep1")}</li>
            <li>{t("perplexityStep2")}</li>
            <li>{t("perplexityStep3")}</li>
          </ol>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Saved Cookies</h3>
        </div>
        {perplexityCookiesLoading ? (
          <div className="flex items-center justify-center rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-6">
            <div className="flex flex-col items-center gap-3">
              <div className="size-6 animate-spin rounded-full border-4 border-[var(--surface-border)] border-t-blue-500"></div>
              <p className="text-xs text-[var(--text-muted)]">Loading cookies...</p>
            </div>
          </div>
        ) : perplexityCookies.length === 0 ? (
          <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-3 text-xs text-[var(--text-muted)]">
            No Perplexity cookies configured yet.
          </div>
        ) : (
          <div className="divide-y divide-[var(--surface-border)] rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)]">
            {perplexityCookies.map((cookie) => (
              <div key={cookie.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{cookie.label || "Unnamed"}</span>
                    <span className={cn(
                      "inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-medium",
                      cookie.isActive
                        ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                        : "border border-[var(--surface-border)]/70 bg-[var(--surface-muted)] text-[var(--text-muted)]"
                    )}>
                      {cookie.isActive ? t("statusActive") : t("statusInactive")}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Added {new Date(cookie.createdAt).toLocaleDateString()}
                    {cookie.lastUsedAt && (
                      <>{t("perplexityLastUsed", { date: new Date(cookie.lastUsedAt).toLocaleDateString() })}</>
                    )}
                  </p>
                </div>
                <Button
                  variant="danger"
                  className="shrink-0 px-2.5 py-1 text-xs"
                  onClick={() => handlePerplexityCookieDelete(cookie.id)}
                >
                  {t("perplexityDeleteButton")}
                </Button>
              </div>
            ))}
          </div>
        )}

        {perplexityCookies.length > 0 && (
          <div className="flex items-center justify-between rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-3">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-[var(--text-secondary)]">Sync Models</p>
              <p className="text-[11px] text-[var(--text-muted)]">Fetch latest models from sidecar and update proxy config</p>
            </div>
            <Button
              className="shrink-0 px-3 py-1.5 text-xs"
              onClick={handlePerplexityModelSync}
              disabled={perplexityModelSyncing}
            >
              {perplexityModelSyncing ? t("perplexitySyncingButton") : t("perplexitySyncButton")}
            </Button>
          </div>
        )}

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Add Cookie</h3>
        </div>
        <div className="space-y-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-3">
          <div>
            <label htmlFor="perplexity-label" className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Label <span className="text-[var(--text-muted)]">(optional)</span>
            </label>
            <input
              id="perplexity-label"
              type="text"
              value={perplexityCookieLabel}
              onChange={(e) => setPerplexityCookieLabel(e.target.value)}
              placeholder={t("perplexityLabelPlaceholder")}
              disabled={perplexityCookieSaving}
              className="glass-input w-full rounded-md px-3 py-1.5 text-sm placeholder:text-[var(--text-muted)] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="perplexity-session-token" className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Session Token <span className="text-red-600">*</span>
            </label>
            <p className="mb-1.5 text-[11px] text-[var(--text-muted)] font-mono">next-auth.session-token</p>
            <div className="relative">
              <input
                id="perplexity-session-token"
                type={showPerplexitySessionToken ? "text" : "password"}
                value={perplexitySessionToken}
                onChange={(e) => setPerplexitySessionToken(e.target.value)}
                placeholder={t("perplexitySessionTokenPlaceholder")}
                disabled={perplexityCookieSaving}
                className="glass-input w-full rounded-md px-3 py-1.5 pr-10 font-mono text-xs placeholder:text-[var(--text-muted)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPerplexitySessionToken(!showPerplexitySessionToken)}
                className="absolute inset-y-0 right-0 flex items-center px-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                tabIndex={-1}
                aria-label={showPerplexitySessionToken ? t("perplexityHideSessionToken") : t("perplexityShowSessionToken")}
              >
                {showPerplexitySessionToken ? (
                  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="perplexity-csrf-token" className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              CSRF Token <span className="text-[var(--text-muted)]">(optional)</span>
            </label>
            <p className="mb-1.5 text-[11px] text-[var(--text-muted)] font-mono">next-auth.csrf-token</p>
            <div className="relative">
              <input
                id="perplexity-csrf-token"
                type={showPerplexityCsrfToken ? "text" : "password"}
                value={perplexityCsrfToken}
                onChange={(e) => setPerplexityCsrfToken(e.target.value)}
                placeholder={t("perplexityCsrfTokenPlaceholder")}
                disabled={perplexityCookieSaving}
                className="glass-input w-full rounded-md px-3 py-1.5 pr-10 font-mono text-xs placeholder:text-[var(--text-muted)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPerplexityCsrfToken(!showPerplexityCsrfToken)}
                className="absolute inset-y-0 right-0 flex items-center px-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                tabIndex={-1}
                aria-label={showPerplexityCsrfToken ? t("perplexityHideCsrfToken") : t("perplexityShowCsrfToken")}
              >
                {showPerplexityCsrfToken ? (
                  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handlePerplexityCookieSave}
              disabled={perplexityCookieSaving || !perplexitySessionToken.trim()}
            >
              {perplexityCookieSaving ? t("perplexitySavingButton") : t("perplexitySaveButton")}
            </Button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
