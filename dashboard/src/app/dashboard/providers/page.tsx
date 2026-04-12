"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  API_KEY_PROVIDERS,
  ApiKeySection,
  PROVIDERS,
  PROVIDER_IDS,
  type ProviderId,
  type ProviderState,
} from "@/components/providers/api-key-section";
import { CustomProviderSection } from "@/components/providers/custom-provider-section";
import { OAuthSection } from "@/components/providers/oauth-section";
import { PerplexityProSection } from "@/components/providers/perplexity-pro-section";
import { useTranslations } from "next-intl";

interface CurrentUser {
  id: string;
  username: string;
  isAdmin: boolean;
}

const loadProvidersData = async (): Promise<Record<ProviderId, ProviderState>> => {
  const newConfigs: Record<ProviderId, ProviderState> = {
    [PROVIDER_IDS.CLAUDE]: { keys: [] },
    [PROVIDER_IDS.GEMINI]: { keys: [] },
    [PROVIDER_IDS.CODEX]: { keys: [] },
    [PROVIDER_IDS.OPENAI]: { keys: [] },
  };

  for (const provider of PROVIDERS) {
    try {
      const res = await fetch(`/api/providers/keys?provider=${provider.id}`);
      if (res.ok) {
        const data = await res.json();
        const keys = data.data?.keys ?? data.keys;
        if (Array.isArray(keys)) {
          newConfigs[provider.id] = { keys };
        }
      }
    } catch {}
  }

  return newConfigs;
};

export default function ProvidersPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [configs, setConfigs] = useState<Record<ProviderId, ProviderState>>(() => ({
    [PROVIDER_IDS.CLAUDE]: { keys: [] },
    [PROVIDER_IDS.GEMINI]: { keys: [] },
    [PROVIDER_IDS.CODEX]: { keys: [] },
    [PROVIDER_IDS.OPENAI]: { keys: [] },
  }));
  const [loading, setLoading] = useState(true);
  const [maxKeysPerUser, setMaxKeysPerUser] = useState<number>(10);
  const [oauthAccountCount, setOauthAccountCount] = useState(0);
  const [customProviderCount, setCustomProviderCount] = useState(0);
  const { showToast } = useToast();
  const t = useTranslations("providers");

  const loadCurrentUser = useCallback(async (): Promise<CurrentUser | null> => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        const user = { id: data.id, username: data.username, isAdmin: data.isAdmin };
        setCurrentUser(user);
        return user;
      }
    } catch {}
    return null;
  }, []);

  const loadMaxKeysPerUser = useCallback(async (isAdminUser: boolean) => {
    if (!isAdminUser) return;
    try {
      const res = await fetch("/api/admin/settings");
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
    } catch {}
  }, []);

  const refreshProviders = async () => {
    setLoading(true);
    const newConfigs = await loadProvidersData();
    setConfigs(newConfigs);
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const user = await loadCurrentUser();
      const newConfigs = await loadProvidersData();
      if (!isMounted) return;
      setConfigs(newConfigs);
      setLoading(false);

      if (user?.isAdmin) {
        await loadMaxKeysPerUser(true);
      }
    };
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      isMounted = false;
    };
  }, [loadCurrentUser, loadMaxKeysPerUser]);

  const providerStats = API_KEY_PROVIDERS.map((provider) => ({
    id: provider.id,
    count: configs[provider.id]?.keys.length ?? 0,
  }));
  const totalApiKeys = providerStats.reduce((sum, item) => sum + item.count, 0);
  const activeApiProviders = providerStats.filter((item) => item.count > 0).length;
  const ownApiKeyCount = currentUser
    ? Object.values(configs).reduce(
        (sum, providerConfig) => sum + providerConfig.keys.filter((key) => key.isOwn).length,
        0
      )
    : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
          AI Provider Configuration
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Manage API keys, OAuth accounts, and custom provider endpoints in one place.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">API Keys</p>
          <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">
            {totalApiKeys} configured{currentUser ? ` · ${ownApiKeyCount} yours` : ""}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Active Providers</p>
          <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{activeApiProviders}/{API_KEY_PROVIDERS.length}</p>
        </div>
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">OAuth Accounts</p>
          <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{oauthAccountCount} connected</p>
        </div>
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Custom Providers</p>
          <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{customProviderCount} configured</p>
        </div>
      </section>

      {loading ? (
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-6">
          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="size-8 animate-spin rounded-full border-4 border-[#ddd] border-t-blue-500"></div>
              <p className="text-[var(--text-secondary)]">Loading providers...</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-6 space-y-6">
            <ApiKeySection
              showToast={showToast}
              currentUser={currentUser}
              configs={configs}
              maxKeysPerUser={maxKeysPerUser}
              refreshProviders={refreshProviders}
            />

            <div className="border-t border-[var(--surface-border)] pt-6">
              <OAuthSection
                showToast={showToast}
                currentUser={currentUser}
                refreshProviders={refreshProviders}
                onAccountCountChange={setOauthAccountCount}
                incognitoBrowserEnabled={incognitoBrowserEnabled}
              />
            </div>

            <div className="border-t border-[var(--surface-border)] pt-6">
              <CustomProviderSection
                showToast={showToast}
                onProviderCountChange={setCustomProviderCount}
              />
            </div>

          <PerplexityProSection showToast={showToast} />

          {currentUser?.isAdmin && (
            <section id="provider-admin" className="space-y-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Admin Settings</h2>
                <p className="text-xs text-[var(--text-muted)]">Provider limits and policies</p>
              </div>

              <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Key Contribution Limits</h3>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Control how many provider keys each user can contribute
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label htmlFor="max-keys" className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">
                      Max Keys Per User
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
                    <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                      Maximum number of provider keys a single user can contribute (current: {maxKeysPerUser})
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    className="mt-6"
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/admin/settings", {
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
                          showToast(data.error || t("toastSettingSaveFailed"), "error");
                        }
                      } catch {
                        showToast(t("toastNetworkError"), "error");
                      }
                    }}
                  >
                    {t("saveButton")}
                  </Button>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
