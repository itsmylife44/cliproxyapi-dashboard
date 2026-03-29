import { prisma } from "@/lib/db";
import { decryptProviderKey } from "@/lib/providers/encrypt";
import { syncCustomProviderToProxy } from "@/lib/providers/custom-provider-sync";
import { invalidateProxyModelsCache } from "@/lib/cache";
import { logger } from "@/lib/logger";

export interface ResyncResult {
  providerId: string;
  name: string;
  status: "ok" | "skipped" | "failed";
  reason?: string;
}

export async function resyncCustomProviders(userId?: string): Promise<ResyncResult[]> {
  const providers = await prisma.customProvider.findMany({
    where: userId ? { userId } : undefined,
    include: { models: true, excludedModels: true },
    orderBy: { sortOrder: "asc" },
  });

  if (providers.length === 0) return [];

  const results: ResyncResult[] = [];

  for (const provider of providers) {
    if (!provider.apiKeyEncrypted) {
      results.push({ providerId: provider.providerId, name: provider.name, status: "skipped", reason: "no_encrypted_key" });
      continue;
    }

    const apiKey = decryptProviderKey(provider.apiKeyEncrypted);
    if (!apiKey) {
      results.push({ providerId: provider.providerId, name: provider.name, status: "failed", reason: "decrypt_failed" });
      logger.error({ providerId: provider.providerId }, "Resync: failed to decrypt API key");
      continue;
    }

    try {
      const { syncStatus, syncMessage } = await syncCustomProviderToProxy({
        providerId: provider.providerId,
        prefix: provider.prefix,
        baseUrl: provider.baseUrl,
        apiKey,
        proxyUrl: provider.proxyUrl,
        headers: provider.headers as Record<string, string> | null,
        models: provider.models,
        excludedModels: provider.excludedModels,
      }, "update");

      results.push({ providerId: provider.providerId, name: provider.name, status: syncStatus, reason: syncMessage });
    } catch (err) {
      logger.error({ err, providerId: provider.providerId }, "Resync: sync threw");
      results.push({ providerId: provider.providerId, name: provider.name, status: "failed", reason: "sync_threw" });
    }
  }

  invalidateProxyModelsCache();

  const synced = results.filter(r => r.status === "ok").length;
  const skipped = results.filter(r => r.status === "skipped").length;
  const failed = results.filter(r => r.status === "failed").length;
  logger.info({ synced, skipped, failed }, "Custom provider resync completed");

  return results;
}
