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

  const loadCurrentUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentUser({ id: data.id, username: data.username, isAdmin: data.isAdmin });
      }
    } catch {}
  }, []);

  const loadMaxKeysPerUser = useCallback(async () => {
    if (!currentUser?.isAdmin) return;
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
  }, [currentUser]);

  const refreshProviders = async () => {
    setLoading(true);
    const newConfigs = await loadProvidersData();
    setConfigs(newConfigs);
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      await loadCurrentUser();
      const newConfigs = await loadProvidersData();
      if (!isMounted) return;
      setConfigs(newConfigs);
      setLoading(false);
    };
    setLoading(true);
    void load();
    return () => {
      isMounted = false;
    };
  }, [loadCurrentUser]);

  useEffect(() => {
    if (currentUser?.isAdmin) {
      void loadMaxKeysPerUser();
    }
  }, [currentUser, loadMaxKeysPerUser]);

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
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-100">
          AI Provider Configuration
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage API keys, OAuth accounts, and custom provider endpoints in one place.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">API Keys</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-100">
            {totalApiKeys} configured{currentUser ? ` · ${ownApiKeyCount} yours` : ""}
          </p>
        </div>
        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Active Providers</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-100">{activeApiProviders}/{API_KEY_PROVIDERS.length}</p>
        </div>
        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">OAuth Accounts</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-100">{oauthAccountCount} connected</p>
        </div>
        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Custom Providers</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-100">{customProviderCount} configured</p>
        </div>
      </section>

      {loading ? (
        <div className="rounded-md border border-slate-700/70 bg-slate-900/30 p-6">
          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="size-8 animate-spin rounded-full border-4 border-white/20 border-t-blue-500"></div>
              <p className="text-white/80">Loading providers...</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <ApiKeySection
            showToast={showToast}
            currentUser={currentUser}
            configs={configs}
            maxKeysPerUser={maxKeysPerUser}
            refreshProviders={refreshProviders}
          />

          <OAuthSection
            showToast={showToast}
            currentUser={currentUser}
            refreshProviders={refreshProviders}
            onAccountCountChange={setOauthAccountCount}
          />

          <CustomProviderSection
            showToast={showToast}
            onProviderCountChange={setCustomProviderCount}
          />

          <PerplexityProSection showToast={showToast} />

          {currentUser?.isAdmin && (
            <section id="provider-admin" className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Admin Settings</h2>
                <p className="text-xs text-slate-400">Provider limits and policies</p>
              </div>

              <div className="rounded-md border border-slate-700/70 bg-slate-900/30 p-4">
                <h3 className="text-sm font-semibold text-slate-100">Key Contribution Limits</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Control how many provider keys each user can contribute
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label htmlFor="max-keys" className="mb-2 block text-sm font-semibold text-slate-300">
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
                    <p className="mt-1.5 text-xs text-slate-500">
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
                          showToast("Setting updated successfully", "success");
                        } else {
                          const data = await res.json();
                          showToast(data.error || "Failed to update setting", "error");
                        }
                      } catch {
                        showToast("Network error", "error");
                      }
                    }}
                  >
                    Save
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
