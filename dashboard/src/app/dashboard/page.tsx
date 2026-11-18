import { redirect } from "next/navigation";
import { QuickStartHero } from "@/components/quick-start-hero";
import { QuickStartConfigSection } from "@/components/quick-start-config-section";
import { ConfigPublisher } from "@/components/config-publisher";
import { ConfigSubscriber } from "@/components/config-subscriber";
import { verifySession } from "@/lib/auth/session";
import { getManagementUrl, getProxyBaseUrl } from "@/lib/management-url";
import { prisma } from "@/lib/db";
import { validateFullConfig, type OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";
import { validateSlimConfig, type OhMyOpenCodeSlimFullConfig } from "@/lib/config-generators/oh-my-opencode-slim-types";
import { buildAvailableModelIds, fetchProxyModels } from "@/lib/config-generators/shared";
import { getProxyUrl, getInternalProxyUrl, buildAvailableModelsFromProxy, extractOAuthModelAliases, fetchModelsDevLimits, inferModelDefinition } from "@/lib/config-generators/opencode";
import type { ConfigData } from "@/lib/config-generators/shared";
import { resolveOwnedByDisplay } from "@/lib/providers/model-grouping";
import { LazyDashboardMiniCharts } from "@/components/lazy-dashboard-mini-charts";
import { OmoSettingsNotice } from "@/components/omo-settings-notice";
import { shouldShowOmoSettingsNotice } from "@/lib/config-generators/upstream/plugins";
import { getTranslations } from 'next-intl/server';
import { PROVIDER_CONFIG_KEYS } from "@/lib/providers/constants";

interface ManagementFetchParams {
  path: string;
}

async function fetchManagementJson({ path }: ManagementFetchParams) {
  try {
    const baseUrl = getManagementUrl();
    const res = await fetch(`${baseUrl}/${path}`, {
      headers: {
        Authorization: `Bearer ${process.env.MANAGEMENT_API_KEY}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getServiceHealth() {
  try {
    const root = `${getProxyBaseUrl()}/`;
    const res = await fetch(root, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

interface OAuthAccountEntry {
  id: string;
  name: string;
  type?: string;
  provider?: string;
  disabled?: boolean;
}

function extractOAuthAccounts(data: unknown): OAuthAccountEntry[] {
  if (typeof data !== "object" || data === null) return [];
  const record = data as Record<string, unknown>;
  const files = record["files"];
  if (!Array.isArray(files)) return [];
  return files
    .filter((entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null && "name" in entry
    )
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : String(entry.name),
      name: String(entry.name),
      type: typeof entry.type === "string" ? entry.type : undefined,
      provider: typeof entry.provider === "string" ? entry.provider : undefined,
      disabled: typeof entry.disabled === "boolean" ? entry.disabled : undefined,
    }));
}

function buildSourceMap(proxyModels: { id: string; owned_by: string }[]): Map<string, string> {
  const sourceMap = new Map<string, string>();
  for (const m of proxyModels) {
    sourceMap.set(m.id, resolveOwnedByDisplay(m.owned_by));
  }
  return sourceMap;
}

function buildProvidersMap(proxyModels: { id: string; owned_by: string }[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const m of proxyModels) {
    const display = resolveOwnedByDisplay(m.owned_by);
    const existing = map.get(m.id) ?? [];
    if (!existing.includes(display)) {
      map.set(m.id, [...existing, display]);
    }
  }
  return map;
}

export default async function QuickStartPage() {
  const t = await getTranslations('dashboard');

  const [config, isHealthy, oauthData, session] = await Promise.all([
    fetchManagementJson({ path: "config" }),
    getServiceHealth(),
    fetchManagementJson({ path: "auth-files" }),
    verifySession(),
  ]);

  const [modelPreference, agentOverride, activeSyncTokens, publishStatus, subscribeStatus, userApiKeys] = session
    ? await Promise.all([
        prisma.modelPreference.findUnique({ where: { userId: session.userId } }),
        prisma.agentModelOverride.findUnique({ where: { userId: session.userId } }),
        prisma.syncToken.findMany({
          where: { userId: session.userId },
          select: { id: true },
        }),
        prisma.configTemplate.findUnique({ where: { userId: session.userId } }),
        prisma.configSubscription.findUnique({ 
          where: { userId: session.userId },
          include: { template: true },
        }),
        prisma.userApiKey.findMany({
          where: { userId: session.userId },
          select: { id: true, key: true, name: true },
        }),
      ])
    : [null, null, [], null, null, []];
  const hasSyncActive = activeSyncTokens.length > 0;
  const hasApiKey = userApiKeys.length > 0;
  const isPublisher = publishStatus !== null;
  const isSubscriber = subscribeStatus !== null && subscribeStatus.isActive && subscribeStatus.template?.isActive;

  // Load publisher's config if user is an active subscriber
  let publisherModelPreference = null;
  let publisherAgentOverride = null;
  if (isSubscriber && subscribeStatus?.template) {
    const publisherId = subscribeStatus.template.userId;
    [publisherModelPreference, publisherAgentOverride] = await Promise.all([
      prisma.modelPreference.findUnique({ where: { userId: publisherId } }),
      prisma.agentModelOverride.findUnique({ where: { userId: publisherId } }),
    ]);
  }

  // Use publisher's excluded models if subscribed, otherwise own
  const initialExcludedModels = isSubscriber && publisherModelPreference
    ? publisherModelPreference.excludedModels
    : (modelPreference?.excludedModels ?? []);
  
  // Use publisher's overrides for model selection, but keep subscriber's MCPs
  const publisherOverrides = validateFullConfig(publisherAgentOverride?.overrides);
  const subscriberOverrides = validateFullConfig(agentOverride?.overrides);
  const agentOverrides: OhMyOpenCodeFullConfig = isSubscriber
    ? { ...publisherOverrides, mcpServers: subscriberOverrides.mcpServers, customPlugins: subscriberOverrides.customPlugins }
    : subscriberOverrides;
  // Same plugin merge as the sync bundle: subscribers get publisher plugins plus their own.
  // ponytail: ignores backup-imported frozenConfig (rare); reuse the bundle's merge if that matters.
  const syncedPlugins = isSubscriber
    ? [...(publisherOverrides.customPlugins ?? []), ...(subscriberOverrides.customPlugins ?? [])]
    : subscriberOverrides.customPlugins;
  const showOmoNotice = session !== null && shouldShowOmoSettingsNotice(syncedPlugins, hasSyncActive);

  // Slim overrides — validate from DB, subscriber inherits publisher's if non-empty
  const publisherSlimOverrides = publisherAgentOverride?.slimOverrides
    ? validateSlimConfig(publisherAgentOverride.slimOverrides)
    : {};
  const subscriberSlimOverrides = agentOverride?.slimOverrides
    ? validateSlimConfig(agentOverride.slimOverrides)
    : {};
  const slimOverrides: OhMyOpenCodeSlimFullConfig = isSubscriber && Object.keys(publisherSlimOverrides).length > 0
    ? publisherSlimOverrides
    : subscriberSlimOverrides;

  const apiKeys = userApiKeys.map((k) => ({ key: k.key, name: k.name }));
  const oauthAccounts = extractOAuthAccounts(oauthData);

  const configProviderCount = PROVIDER_CONFIG_KEYS.filter((key) => {
    const value = config?.[key];
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  }).length;

  const activeOAuthProviders = new Set<string>();
  for (const account of oauthAccounts) {
    if (!account.disabled) {
      const provider = account.provider || account.type;
      if (provider) activeOAuthProviders.add(provider);
    }
  }

  const providerCount = configProviderCount + activeOAuthProviders.size;

  const [firstUserApiKey] = userApiKeys;
  const apiKeyForProxy = firstUserApiKey?.key ?? "";
  const [proxyModels, modelsDevLimits, customProviders] = await Promise.all([
    apiKeyForProxy ? fetchProxyModels(getInternalProxyUrl(), apiKeyForProxy) : Promise.resolve([]),
    fetchModelsDevLimits(),
    session
      ? prisma.customProvider.findMany({
          where: {
            OR: [
              { userId: session.userId },
              { isShared: true }
            ]
          },
          include: { models: true },
          orderBy: { sortOrder: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const oauthAliasModels = extractOAuthModelAliases(config as ConfigData | null, oauthAccounts, modelsDevLimits);
  const oauthAliasIds = Object.keys(oauthAliasModels);
  const availableModelIds = buildAvailableModelIds(proxyModels, oauthAliasIds);
  const modelSourceMap = buildSourceMap(proxyModels);
  const modelProvidersMap = buildProvidersMap(proxyModels);
  for (const aliasId of oauthAliasIds) {
    modelSourceMap.set(aliasId, t('modelSourceOAuthAlias'));
    const existing = modelProvidersMap.get(aliasId) ?? [];
    if (!existing.includes("OAuth Alias")) {
      modelProvidersMap.set(aliasId, [...existing, "OAuth Alias"]);
    }
  }
  for (const cp of customProviders) {
    const label = cp.name;
    for (const m of cp.models) {
      const id = m.alias;
      if (!availableModelIds.includes(id)) {
        availableModelIds.push(id);
      }
      if (!modelSourceMap.has(id)) modelSourceMap.set(id, label);
      const existingProviders = modelProvidersMap.get(id) ?? [];
      if (!existingProviders.includes(label)) {
        modelProvidersMap.set(id, [...existingProviders, label]);
      }
    }
  }
  availableModelIds.sort((a, b) => a.localeCompare(b));
  const allProxyModels = { ...oauthAliasModels, ...buildAvailableModelsFromProxy(proxyModels, modelsDevLimits) };
  for (const cp of customProviders) {
    for (const m of cp.models) {
      if (!(m.alias in allProxyModels)) {
        const def = inferModelDefinition(m.upstreamName, cp.providerId, modelsDevLimits);
        allProxyModels[m.alias] = { ...def, name: `${m.alias} (via ${cp.name})` };
      }
    }
  }
  const setupItems = [
    {
      label: t('setupProviderConnectedLabel'),
      done: providerCount > 0,
      link: "/dashboard/providers",
      linkLabel: t('setupProviderConnectedLink'),
    },
    {
      label: t('setupApiKeyCreatedLabel'),
      done: apiKeys.length > 0,
      link: "/dashboard/api-keys",
      linkLabel: t('setupApiKeyCreatedLink'),
    },
    {
      label: t('setupModelCatalogLabel'),
      done: availableModelIds.length > 0,
      link: "/dashboard/providers",
      linkLabel: t('setupModelCatalogLink'),
    },
  ];
  const completedSetupItems = setupItems.filter((item) => item.done).length;
  const shouldShowSetupChecklist = completedSetupItems < setupItems.length;

  // Redirect to setup wizard if setup is incomplete (unless skipped in dev)
  if (shouldShowSetupChecklist && process.env.SKIP_SETUP_WIZARD !== "true") {
    redirect("/dashboard/setup");
  }
  return (
    <div className="space-y-6">
      <QuickStartHero
        isHealthy={isHealthy}
        providerCount={providerCount}
        apiKeyCount={apiKeys.length}
        modelCount={availableModelIds.length}
        proxyUrl={getProxyUrl()}
      />

      {showOmoNotice && <OmoSettingsNotice userId={session.userId} />}

      <LazyDashboardMiniCharts />

      <QuickStartConfigSection
        apiKeys={apiKeys}
        config={config}
        oauthAccounts={oauthAccounts}
        availableModels={availableModelIds}
        allModels={allProxyModels}
        modelSourceMap={modelSourceMap}
        modelProvidersMap={modelProvidersMap}
        initialExcludedModels={initialExcludedModels}
        agentOverrides={agentOverrides}
        slimOverrides={slimOverrides}
        isSubscribed={isSubscriber}
        proxyUrl={getProxyUrl()}
      />

      <section id="sharing" className="scroll-mt-24 border-t border-[var(--surface-border)] pt-5">
        <details className="group/details">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-1">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{t('publisherSubscriberTitle')}</p>
              <p className="text-xs text-[var(--text-muted)]">{t('publisherSubscriberDescription')}</p>
            </div>
            <svg className="h-4 w-4 text-[var(--text-muted)] transition-transform duration-200 group-open/details:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
          </summary>
          <div className="mt-4 grid gap-6 border-t border-[var(--surface-border)] pt-4 2xl:grid-cols-2">
            {!isSubscriber && <ConfigPublisher />}
            {!isPublisher && <ConfigSubscriber hasApiKey={hasApiKey} />}
          </div>
        </details>
      </section>
    </div>
  );
}
