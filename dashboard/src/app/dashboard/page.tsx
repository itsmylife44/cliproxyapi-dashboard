import Link from "next/link";
import { redirect } from "next/navigation";
import { CopyBlock } from "@/components/copy-block";
import { QuickStartConfigSection } from "@/components/quick-start-config-section";
import { ConfigPublisher } from "@/components/config-publisher";
import { ConfigSubscriber } from "@/components/config-subscriber";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";
import { validateSlimConfig, type OhMyOpenCodeSlimFullConfig } from "@/lib/config-generators/oh-my-opencode-slim-types";
import { buildAvailableModelIds, fetchProxyModels } from "@/lib/config-generators/shared";
import { getProxyUrl, getInternalProxyUrl, buildAvailableModelsFromProxy, extractOAuthModelAliases, fetchModelsDevLimits, inferModelDefinition } from "@/lib/config-generators/opencode";
import type { ConfigData } from "@/lib/config-generators/shared";
import { resolveOwnedByDisplay } from "@/lib/providers/model-grouping";
import { LazyDashboardMiniCharts } from "@/components/lazy-dashboard-mini-charts";
import { getTranslations } from 'next-intl/server';

interface ManagementFetchParams {
  path: string;
}

async function fetchManagementJson({ path }: ManagementFetchParams) {
  try {
    const baseUrl =
      process.env.CLIPROXYAPI_MANAGEMENT_URL ||
      "http://cliproxyapi:8317/v0/management";
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
    const baseUrl =
      process.env.CLIPROXYAPI_MANAGEMENT_URL ||
      "http://cliproxyapi:8317/v0/management";
    const root = baseUrl.replace(/\/v0\/management\/?$/, "/");
    const res = await fetch(root, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

function getClaudeCodeEnv(): string {
  return `export ANTHROPIC_BASE_URL=${getProxyUrl()}
export ANTHROPIC_AUTH_TOKEN=your-api-key
export ANTHROPIC_DEFAULT_SONNET_MODEL=gemini-2.5-flash`;
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
  const publisherOverrides = (publisherAgentOverride?.overrides ?? {}) as OhMyOpenCodeFullConfig;
  const subscriberOverrides = (agentOverride?.overrides ?? {}) as OhMyOpenCodeFullConfig;
  const agentOverrides: OhMyOpenCodeFullConfig = isSubscriber
    ? { ...publisherOverrides, mcpServers: subscriberOverrides.mcpServers, customPlugins: subscriberOverrides.customPlugins }
    : subscriberOverrides;

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

  const providerKeys = [
    "gemini-api-key",
    "claude-api-key",
    "codex-api-key",
    "vertex-api-key",
    "openai-compatibility",
  ];
  const configProviderCount = providerKeys.filter((key) => {
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
          where: { userId: session.userId },
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
  const statusCards = [
    {
      label: t('statusServiceLabel'),
      value: isHealthy ? t('statusOnline') : t('statusOffline'),
      tone: isHealthy ? "text-emerald-600" : "text-rose-600",
      icon: "●",
      iconTone: isHealthy ? "text-emerald-700" : "text-rose-600",
    },
    {
      label: t('statusProvidersLabel'),
      value: t('statusProvidersValue', { count: providerCount }),
      tone: "text-[var(--text-primary)]",
      icon: "◆",
      iconTone: "text-blue-600",
    },
    {
      label: t('statusApiKeysLabel'),
      value: t('statusApiKeysValue', { count: apiKeys.length }),
      tone: "text-[var(--text-primary)]",
      icon: "♟",
      iconTone: "text-amber-700",
    },
    {
      label: t('statusProxyUrlLabel'),
      value: getProxyUrl(),
      tone: "text-[var(--text-primary)]",
      icon: "◈",
      iconTone: "text-[var(--text-secondary)]",
      truncate: true,
    },
  ] as const;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">{t('quickStartTitle')}</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Configure providers, generate client config, and validate access from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/providers"
              className="rounded-md border border-[var(--surface-border)]/80 bg-[var(--surface-muted)]/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)]/80"
            >
              {t('navProviders')}
            </Link>
            <Link
              href="/dashboard/api-keys"
              className="rounded-md border border-[var(--surface-border)]/80 bg-[var(--surface-muted)]/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)]/80"
            >
              {t('navApiKeys')}
            </Link>
            <Link
              href="/dashboard/settings"
              className="rounded-md border border-[var(--surface-border)]/80 bg-[var(--surface-muted)]/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)]/80"
            >
              {t('navSettings')}
            </Link>
          </div>
        </div>
      </section>

      <section id="overview" className="scroll-mt-24">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
          {statusCards.map((card) => (
            <div key={card.label} className="glass-card rounded-md border border-[var(--surface-border)] px-2.5 py-2 transition-colors hover:border-[var(--surface-border)]">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{card.label}</div>
                <span className={`text-xs ${card.iconTone}`} aria-hidden="true">{card.icon}</span>
              </div>
              <div className={`mt-0.5 text-xs font-semibold ${card.tone} ${"truncate" in card && card.truncate ? "truncate" : ""}`} title={String(card.value)}>
                {card.value}
              </div>
            </div>
          ))}
        </div>
      </section>

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
        hasSyncActive={hasSyncActive}
        isSubscribed={isSubscriber}
        proxyUrl={getProxyUrl()}
      />

      <section id="sharing" className="scroll-mt-24">
        <details className="group/details rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{t('publisherSubscriberTitle')}</p>
              <p className="text-xs text-[var(--text-muted)]">{t('publisherSubscriberDescription')}</p>
            </div>
            <svg className="h-4 w-4 text-[var(--text-muted)] transition-transform duration-200 group-open/details:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
          </summary>
          <div className="grid gap-3 border-t border-[var(--surface-border)] px-4 py-3 2xl:grid-cols-2">
            {!isSubscriber && <ConfigPublisher />}
            {!isPublisher && <ConfigSubscriber hasApiKey={hasApiKey} />}
          </div>
        </details>
      </section>

      <section id="integrations" className="scroll-mt-24">
        <details className="group/details rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{t('integrationsTitle')}</p>
              <p className="text-xs text-[var(--text-muted)]">{t('integrationsDescription')}</p>
            </div>
            <svg className="h-4 w-4 text-[var(--text-muted)] transition-transform duration-200 group-open/details:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
          </summary>
          <div className="border-t border-[var(--surface-border)] px-4 py-3">
            <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
              <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
                <span className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-blue-500/20 bg-blue-500/10 text-sm text-blue-600" aria-hidden="true">&#9654;</span>
                  Using with Claude Code
                </span>
              </h3>
              <p className="mb-4 text-sm text-[var(--text-secondary)]">
                As an alternative, you can use CLIProxyAPI with Claude Code by setting environment variables before launching it.
                Replace <code className="break-all rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-xs text-blue-600">your-api-key</code> with
                your key from the{" "}
                <Link href="/dashboard/api-keys" className="font-medium text-blue-600 underline decoration-blue-400/30 underline-offset-2 hover:text-blue-800">
                  {t('claudeCodeApiKeysLink')}
                </Link>{" "}
                {t('claudeCodePageSuffix')}
              </p>
              <CopyBlock code={getClaudeCodeEnv()} />
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
