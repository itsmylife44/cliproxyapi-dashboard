import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CopyBlock } from "@/components/copy-block";
import { QuickStartConfigSection } from "@/components/quick-start-config-section";
import { ConfigPublisher } from "@/components/config-publisher";
import { ConfigSubscriber } from "@/components/config-subscriber";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";
import { fetchProxyModels } from "@/lib/config-generators/shared";
import { getProxyUrl, getInternalProxyUrl, buildAvailableModelsFromProxy, extractOAuthModelAliases } from "@/lib/config-generators/opencode";
import type { ConfigData } from "@/lib/config-generators/shared";

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
    const source = m.owned_by === "anthropic" ? "Claude"
      : m.owned_by === "google" || m.owned_by === "antigravity" ? "Gemini"
      : m.owned_by === "openai" ? "OpenAI/Codex"
      : m.owned_by;
    sourceMap.set(m.id, source);
  }
  return sourceMap;
}

export default async function QuickStartPage() {
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
          where: { userId: session.userId, revokedAt: null },
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

  const apiKeyForProxy = userApiKeys.length > 0 ? userApiKeys[0].key : "";
  const proxyModels = apiKeyForProxy ? await fetchProxyModels(getInternalProxyUrl(), apiKeyForProxy) : [];
  const oauthAliasModels = extractOAuthModelAliases(config as ConfigData | null, oauthAccounts);
  const oauthAliasIds = Object.keys(oauthAliasModels);
  const availableModelIds = [...proxyModels.map((m) => m.id), ...oauthAliasIds];
  const modelSourceMap = buildSourceMap(proxyModels);
  for (const aliasId of oauthAliasIds) {
    modelSourceMap.set(aliasId, "OAuth Alias");
  }
  const allProxyModels = { ...buildAvailableModelsFromProxy(proxyModels), ...oauthAliasModels };
  const setupItems = [
    {
      label: "Provider connected",
      done: providerCount > 0,
      link: "/dashboard/providers",
      linkLabel: "Providers",
    },
    {
      label: "API key created",
      done: apiKeys.length > 0,
      link: "/dashboard/api-keys",
      linkLabel: "API Keys",
    },
    {
      label: "Model catalog available",
      done: availableModelIds.length > 0,
      link: "/dashboard/providers",
      linkLabel: "Verify providers",
    },
  ];
  const completedSetupItems = setupItems.filter((item) => item.done).length;
  const shouldShowSetupChecklist = completedSetupItems < setupItems.length;
  const statusCards = [
    {
      label: "Service",
      value: isHealthy ? "Online" : "Offline",
      tone: isHealthy ? "text-emerald-400" : "text-rose-400",
      icon: "●",
      iconTone: isHealthy ? "text-emerald-300" : "text-rose-300",
    },
    {
      label: "Providers",
      value: `${providerCount} configured`,
      tone: "text-slate-100",
      icon: "◆",
      iconTone: "text-blue-300",
    },
    {
      label: "API Keys",
      value: `${apiKeys.length} active`,
      tone: "text-slate-100",
      icon: "♟",
      iconTone: "text-amber-300",
    },
    {
      label: "Proxy URL",
      value: getProxyUrl(),
      tone: "text-slate-100",
      icon: "◈",
      iconTone: "text-cyan-300",
      truncate: true,
    },
  ] as const;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">Quick Start</h1>
            <p className="mt-1 text-sm text-slate-400">
              Configure providers, generate client config, and validate access from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/providers"
              className="rounded-md border border-slate-600/80 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-slate-200 transition-colors hover:bg-slate-700/80"
            >
              Providers
            </Link>
            <Link
              href="/dashboard/api-keys"
              className="rounded-md border border-slate-600/80 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-slate-200 transition-colors hover:bg-slate-700/80"
            >
              API Keys
            </Link>
            <Link
              href="/dashboard/settings"
              className="rounded-md border border-slate-600/80 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-slate-200 transition-colors hover:bg-slate-700/80"
            >
              Settings
            </Link>
          </div>
        </div>
      </section>

      <section
        id="overview"
        className={`scroll-mt-24 grid gap-3 ${shouldShowSetupChecklist ? "xl:grid-cols-[minmax(0,2.2fr)_minmax(280px,1fr)]" : ""}`}
      >
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {statusCards.map((card) => (
            <div key={card.label} className="glass-card rounded-md border border-slate-700/70 px-2.5 py-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{card.label}</div>
                <span className={`text-xs ${card.iconTone}`} aria-hidden="true">{card.icon}</span>
              </div>
              <div className={`mt-0.5 text-xs font-semibold ${card.tone} ${"truncate" in card && card.truncate ? "truncate" : ""}`}>
                {card.value}
              </div>
            </div>
          ))}
        </div>

        {shouldShowSetupChecklist && (
          <Card>
            <CardHeader>
              <CardTitle>Setup Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-slate-400">
                {completedSetupItems}/{setupItems.length} steps complete
              </p>
              <div className="space-y-2.5">
                {setupItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-slate-700/70 bg-slate-900/40 px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <span className={item.done ? "text-emerald-400" : "text-amber-300"} aria-hidden="true">
                        {item.done ? "●" : "○"}
                      </span>
                      <span className="text-sm text-slate-200">{item.label}</span>
                    </div>
                    {!item.done && (
                      <Link href={item.link} className="text-xs font-medium text-blue-300 hover:text-blue-200">
                        {item.linkLabel}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <QuickStartConfigSection
        apiKeys={apiKeys}
        config={config}
        oauthAccounts={oauthAccounts}
        availableModels={availableModelIds}
        allModels={allProxyModels}
        modelSourceMap={modelSourceMap}
        initialExcludedModels={initialExcludedModels}
        agentOverrides={agentOverrides}
        hasSyncActive={hasSyncActive}
        isSubscribed={isSubscriber}
        proxyUrl={getProxyUrl()}
      />

      <section id="sharing" className="scroll-mt-24">
        <details className="group rounded-lg border border-slate-700/70 bg-slate-900/40">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">Publisher / Subscriber</p>
              <p className="text-xs text-slate-400">Share your config template or subscribe to another user.</p>
            </div>
            <span className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400 transition-transform duration-200 group-open:rotate-180">⌄</span>
          </summary>
          <div className="grid gap-4 border-t border-slate-700/70 px-4 py-3 2xl:grid-cols-2">
            {!isSubscriber && <ConfigPublisher />}
            {!isPublisher && <ConfigSubscriber hasApiKey={hasApiKey} />}
          </div>
        </details>
      </section>

      <section id="integrations" className="scroll-mt-24">
        <details className="group rounded-lg border border-slate-700/70 bg-slate-900/40">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">Integrations</p>
              <p className="text-xs text-slate-400">Reference setup snippets for external clients.</p>
            </div>
            <span className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400 transition-transform duration-200 group-open:rotate-180">⌄</span>
          </summary>
          <div className="border-t border-slate-700/70 px-4 py-3">
            <div className="rounded-md border border-slate-700/70 bg-slate-900/30 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-100">
                <span className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-blue-400/30 bg-blue-500/15 text-sm text-blue-300" aria-hidden="true">&#9654;</span>
                  Using with Claude Code
                </span>
              </h3>
              <p className="mb-4 text-sm text-slate-300">
                As an alternative, you can use CLIProxyAPI with Claude Code by setting environment variables before launching it.
                Replace <code className="break-all rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-xs text-blue-200">your-api-key</code> with
                your key from the{" "}
                <Link href="/dashboard/api-keys" className="font-medium text-blue-300 underline decoration-blue-400/30 underline-offset-2 hover:text-blue-200">
                  API Keys
                </Link>{" "}
                page.
              </p>
              <CopyBlock code={getClaudeCodeEnv()} />
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
