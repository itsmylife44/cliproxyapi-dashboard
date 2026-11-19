"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { extractApiError } from "@/lib/utils";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { useAuth } from "@/hooks/use-auth";
import {
  API_KEY_PROVIDERS,
  ApiKeySection,
  PROVIDERS,
  PROVIDER_IDS,
  type KeyWithOwnership,
  type ProviderId,
  type ProviderState,
} from "@/components/providers/api-key-section";
import { CustomProviderSection } from "@/components/providers/custom-provider-section";
import { OAuthSection } from "@/components/providers/oauth-section";
import { PerplexityProSection } from "@/components/providers/perplexity-pro-section";

interface CurrentUser {
  id: string;
  username: string;
  isAdmin: boolean;
}

const loadProvidersData = async (signal?: AbortSignal): Promise<Record<ProviderId, ProviderState>> => {
  const newConfigs: Record<ProviderId, ProviderState> = {
    [PROVIDER_IDS.CLAUDE]: { keys: [] },
    [PROVIDER_IDS.GEMINI]: { keys: [] },
    [PROVIDER_IDS.CODEX]: { keys: [] },
    [PROVIDER_IDS.XAI]: { keys: [] },
    [PROVIDER_IDS.VERTEX]: { keys: [] },
    [PROVIDER_IDS.INTERACTIONS]: { keys: [] },
    [PROVIDER_IDS.META]: { keys: [] },
    [PROVIDER_IDS.OPENAI]: { keys: [] },
  };

  const results = await Promise.allSettled(
    PROVIDERS.map(async (provider) => {
      const res = await fetch(`${API_ENDPOINTS.PROVIDERS.KEYS}?provider=${provider.id}`, { signal });
      if (!res.ok) return { id: provider.id, keys: [] as KeyWithOwnership[] };
      const data = await res.json();
      const keys = data.data?.keys ?? data.keys;
      return { id: provider.id, keys: Array.isArray(keys) ? keys : [] };
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      newConfigs[result.value.id as ProviderId] = { keys: result.value.keys };
    }
  }

  return newConfigs;
};

export default function ProvidersPage() {
  const { user: authUser } = useAuth();
  const currentUser: CurrentUser | null = authUser
    ? { id: authUser.id, username: authUser.username, isAdmin: authUser.isAdmin }
    : null;
  const [configs, setConfigs] = useState<Record<ProviderId, ProviderState>>(() => ({
    [PROVIDER_IDS.CLAUDE]: { keys: [] },
    [PROVIDER_IDS.GEMINI]: { keys: [] },
    [PROVIDER_IDS.CODEX]: { keys: [] },
    [PROVIDER_IDS.XAI]: { keys: [] },
    [PROVIDER_IDS.VERTEX]: { keys: [] },
    [PROVIDER_IDS.INTERACTIONS]: { keys: [] },
    [PROVIDER_IDS.META]: { keys: [] },
    [PROVIDER_IDS.OPENAI]: { keys: [] },
  }));
  const [loading, setLoading] = useState(true);
  const [maxKeysPerUser, setMaxKeysPerUser] = useState<number>(10);
  const [oauthAccountCount, setOauthAccountCount] = useState(0);
  const [customProviderCount, setCustomProviderCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"oauth" | "api-keys" | "custom" | "admin">("oauth");
  const { showToast } = useToast();
  const t = useTranslations("providers");

  const loadMaxKeysPerUser = useCallback(async (isAdminUser: boolean, signal?: AbortSignal) => {
    if (!isAdminUser) return;
    try {
      const res = await fetch(API_ENDPOINTS.ADMIN.SETTINGS, { signal });
      if (res.ok) {
        const data = await res.json();
        const setting = data.settings?.find((s: { key: string; value: string }) => s.key === "max_provider_keys_per_user");
        if (setting) {
          const parsed = parseInt(setting.value, 10);
          if (!isNaN(parsed) && parsed > 0) {
            setMaxKeysPerUser(parsed);
          }
        }
      }
    } catch {
      if (signal?.aborted) return;
    }
  }, []);

  const refreshProviders = async () => {
    setLoading(true);
    const newConfigs = await loadProvidersData();
    setConfigs(newConfigs);
    setLoading(false);
  };

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const newConfigs = await loadProvidersData(controller.signal);
      if (controller.signal.aborted) return;
      setConfigs(newConfigs);

      setLoading(false);

      if (authUser?.isAdmin) {
        await loadMaxKeysPerUser(true, controller.signal);
      }
    };
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [authUser, loadMaxKeysPerUser]);

  const totalApiKeys = API_KEY_PROVIDERS.reduce(
    (sum, provider) => sum + (configs[provider.id]?.keys.length ?? 0),
    0
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
          {t("pageTitle")}
        </h1>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          {t("pageDescription")}
        </p>
      </div>

      <div className="border-b border-[var(--surface-border)]">
        <div role="group" aria-label={t("pageTitle")} className="-mb-px flex flex-wrap gap-x-4 gap-y-1 sm:gap-x-6">
          {(
            [
              { id: "oauth", label: t("oauthSectionTitle"), count: oauthAccountCount },
              { id: "api-keys", label: t("statsApiKeysLabel"), count: totalApiKeys },
              { id: "custom", label: t("customSectionTitle"), count: customProviderCount },
              ...(currentUser?.isAdmin
                ? [{ id: "admin" as const, label: t("adminSettingsTitle"), count: null }]
                : []),
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 pb-2 text-xs font-medium transition-colors sm:gap-2 sm:pb-2.5 ${
                  active
                    ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className="rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--text-secondary)]">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <div className="inline-flex flex-col items-center gap-3">
            <div className="size-7 animate-spin rounded-full border-2 border-[var(--surface-border)] border-t-blue-500"></div>
            <p className="text-sm text-[var(--text-muted)]">{t("loadingText")}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div hidden={activeTab !== "oauth"}>
            <OAuthSection
              showToast={showToast}
              currentUser={currentUser}
              refreshProviders={refreshProviders}
              onAccountCountChange={setOauthAccountCount}
            />
          </div>

          <div hidden={activeTab !== "api-keys"}>
            <ApiKeySection
              showToast={showToast}
              currentUser={currentUser}
              configs={configs}
              maxKeysPerUser={maxKeysPerUser}
              refreshProviders={refreshProviders}
            />
          </div>

          <div hidden={activeTab !== "custom"}>
            <CustomProviderSection
              showToast={showToast}
              onProviderCountChange={setCustomProviderCount}
            />
          </div>

          {currentUser?.isAdmin && (
            <div className="space-y-8" hidden={activeTab !== "admin"}>
              <section id="provider-admin" className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t("keyLimitsTitle")}</h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{t("keyLimitsDescription")}</p>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-[220px] flex-1 max-w-sm">
                    <label htmlFor="max-keys" className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                      {t("maxKeysLabel")}
                    </label>
                    <Input
                      type="number"
                      name="max-keys"
                      value={maxKeysPerUser.toString()}
                      onChange={(value) => {
                        const parsed = parseInt(value, 10);
                        if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
                          setMaxKeysPerUser(parsed);
                        }
                      }}
                    />
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {t("maxKeysHint", { current: maxKeysPerUser })}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        const res = await fetch(API_ENDPOINTS.ADMIN.SETTINGS, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            key: "max_provider_keys_per_user",
                            value: maxKeysPerUser.toString(),
                          }),
                        });
                        if (res.ok) {
                          showToast(t("toastSettingSaved"), "success");
                        } else {
                          const data = await res.json();
                          showToast(extractApiError(data, t("toastSettingSaveFailed")), "error");
                        }
                      } catch {
                        showToast(t("toastNetworkError"), "error");
                      }
                    }}
                  >
                    {t("saveButton")}
                  </Button>
                </div>
              </section>

              <div className="border-t border-[var(--surface-border)] pt-6">
                <PerplexityProSection showToast={showToast} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
