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

   return (
     <div className="space-y-5">
       <div>
         <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg">
           Quick Start
         </h1>
        <p className="mt-2 text-sm text-white/60">
          Get up and running with CLIProxyAPI in minutes
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
         <div className="backdrop-blur-2xl glass-card rounded-2xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
              <span className="text-emerald-400 text-lg" aria-hidden="true">&#9679;</span>
            </div>
            <div>
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider">Service</div>
              {isHealthy ? (
                <div className="text-sm font-semibold text-emerald-400">Online</div>
              ) : (
                <div className="text-sm font-semibold text-red-400">Offline</div>
              )}
            </div>
          </div>
        </div>

         <div className="backdrop-blur-2xl glass-card rounded-2xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center">
              <span className="text-violet-400 text-lg" aria-hidden="true">&#9670;</span>
            </div>
            <div>
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider">Providers</div>
              <div className="text-sm font-semibold text-white">{providerCount} configured</div>
            </div>
          </div>
        </div>

         <div className="backdrop-blur-2xl glass-card rounded-2xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
              <span className="text-amber-400 text-lg" aria-hidden="true">&#9919;</span>
            </div>
            <div>
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider">API Keys</div>
              <div className="text-sm font-semibold text-white">{apiKeys.length} active</div>
            </div>
          </div>
        </div>

         <div className="backdrop-blur-2xl glass-card rounded-2xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center">
              <span className="text-cyan-400 text-lg" aria-hidden="true">&#9672;</span>
            </div>
            <div>
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider">Proxy URL</div>
              <div className="text-sm font-semibold text-white truncate">{getProxyUrl()}</div>
            </div>
          </div>
        </div>
      </div>

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

      {!isSubscriber && <ConfigPublisher />}
      {!isPublisher && <ConfigSubscriber hasApiKey={hasApiKey} />}

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-3">
             <span className="w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-sm" aria-hidden="true">&#9654;</span>
               Using with Claude Code
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white/70 mb-4">
            As an alternative, you can use CLIProxyAPI with Claude Code by setting environment variables before launching it.
            Replace <code className="px-1.5 py-0.5 rounded bg-white/10 text-blue-300 text-xs font-mono break-all">your-api-key</code> with
            your key from the{" "}
            <Link href="/dashboard/api-keys" className="text-violet-400 font-medium hover:text-violet-300 underline underline-offset-2 decoration-violet-400/30">
              API Keys
            </Link>{" "}
            page.
          </p>
          <CopyBlock code={getClaudeCodeEnv()} />
        </CardContent>
      </Card>
    </div>
  );
}
