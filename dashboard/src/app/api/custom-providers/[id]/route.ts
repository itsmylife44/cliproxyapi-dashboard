import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { hashProviderKey } from "@/lib/providers/hash";
import { z } from "zod";
import { invalidateProxyModelsCache } from "@/lib/cache";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { syncCustomProviderToProxy } from "@/lib/providers/custom-provider-sync";

const FETCH_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeoutId);
  }
}

const UpdateCustomProviderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  baseUrl: z.string().url().startsWith("https://", "Base URL must start with https://").optional(),
  apiKey: z.string().min(1).optional(),
  prefix: z.string().optional(),
  proxyUrl: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  models: z.array(z.object({
    upstreamName: z.string().min(1),
    alias: z.string().min(1)
  })).min(1, "At least one model mapping is required").optional(),
  excludedModels: z.array(z.string()).optional()
});

interface ManagementApiKeyEntry {
  "api-key"?: string;
}

interface ManagementProviderEntry {
  name?: string;
  "api-key-entries"?: ManagementApiKeyEntry[];
  [key: string]: unknown;
}

function isManagementProviderEntry(value: unknown): value is ManagementProviderEntry {
  return typeof value === "object" && value !== null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const body = await request.json();
    const validated = UpdateCustomProviderSchema.parse(body);

    const existingProvider = await prisma.customProvider.findUnique({
      where: { id },
      include: { models: true, excludedModels: true }
    });

    if (!existingProvider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    if (existingProvider.userId !== session.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (validated.name) {
      const nameConflict = await prisma.customProvider.findFirst({
        where: {
          userId: session.userId,
          name: validated.name,
          id: { not: id }
        }
      });

      if (nameConflict) {
        return NextResponse.json({ error: "Provider name already exists" }, { status: 409 });
      }
    }

    const provider = await prisma.$transaction(async (tx) => {
      if (validated.models) {
        await tx.customProviderModel.deleteMany({
          where: { customProviderId: id }
        });
      }
      
      if (validated.excludedModels !== undefined) {
        await tx.customProviderExcludedModel.deleteMany({
          where: { customProviderId: id }
        });
      }

      return await tx.customProvider.update({
        where: { id },
        data: {
          name: validated.name,
          baseUrl: validated.baseUrl,
          ...(validated.apiKey ? { apiKeyHash: hashProviderKey(validated.apiKey) } : {}),
          prefix: validated.prefix,
          proxyUrl: validated.proxyUrl,
          headers: validated.headers ? (validated.headers as Record<string, string>) : undefined,
          models: validated.models ? {
            create: validated.models.map(m => ({
              upstreamName: m.upstreamName,
              alias: m.alias
            }))
          } : undefined,
          excludedModels: validated.excludedModels !== undefined ? {
            create: validated.excludedModels.map(p => ({ pattern: p }))
          } : undefined
        },
        include: {
          models: true,
          excludedModels: true
        }
      });
    });

    let resolvedApiKey = validated.apiKey;
    let prefetchedConfig: ManagementProviderEntry[] | undefined;

    if (!resolvedApiKey) {
      const managementUrl = env.CLIPROXYAPI_MANAGEMENT_URL;
      const secretKey = env.MANAGEMENT_API_KEY;

      if (secretKey) {
        try {
          const getRes = await fetchWithTimeout(`${managementUrl}/openai-compatibility`, {
            headers: { "Authorization": `Bearer ${secretKey}` }
          });
          
          if (getRes.ok) {
            const configData = (await getRes.json()) as Record<string, unknown>;
            const openAiCompatibility = configData["openai-compatibility"];
            const currentList: ManagementProviderEntry[] = Array.isArray(openAiCompatibility)
              ? openAiCompatibility.filter(isManagementProviderEntry)
              : [];
            
            prefetchedConfig = currentList;

            const currentEntry = currentList.find((entry) => entry.name === provider.providerId);
            const apiKeyEntries = currentEntry?.["api-key-entries"];
            if (Array.isArray(apiKeyEntries) && apiKeyEntries.length > 0) {
              const firstEntry = apiKeyEntries[0];
              if (firstEntry && typeof firstEntry["api-key"] === "string") {
                resolvedApiKey = firstEntry["api-key"];
              }
            }
          }
        } catch (err) {
          logger.error({ err }, "Failed to retrieve existing API key for update");
        }
      }
    }

    let syncStatus: "ok" | "failed" = "ok";
    let syncMessage: string | undefined;

    if (resolvedApiKey) {
      const syncResult = await syncCustomProviderToProxy({
        providerId: provider.providerId,
        prefix: provider.prefix,
        baseUrl: provider.baseUrl,
        apiKey: resolvedApiKey,
        proxyUrl: provider.proxyUrl,
        headers: provider.headers as Record<string, string> | null,
        models: provider.models,
        excludedModels: provider.excludedModels
      }, "update", prefetchedConfig);

      syncStatus = syncResult.syncStatus;
      syncMessage = syncResult.syncMessage;
    } else {
      syncStatus = "failed";
      syncMessage = "Backend sync failed - could not retrieve API key for update";
      logger.error("Failed to sync updated custom provider: no API key available");
    }

    logAuditAsync({
      userId: session.userId,
      action: AUDIT_ACTION.CUSTOM_PROVIDER_UPDATED,
      target: provider.providerId,
      metadata: {
        providerId: id,
        name: provider.name,
        updatedFields: Object.keys(validated),
      },
      ipAddress: extractIpAddress(request),
    });

    return NextResponse.json({ provider, syncStatus, syncMessage });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    logger.error({ err: error }, "PATCH /api/custom-providers/[id] error");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const existingProvider = await prisma.customProvider.findUnique({
      where: { id }
    });

    if (!existingProvider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    if (existingProvider.userId !== session.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await prisma.customProvider.delete({
      where: { id }
    });

    logAuditAsync({
      userId: session.userId,
      action: AUDIT_ACTION.CUSTOM_PROVIDER_DELETED,
      target: existingProvider.providerId,
      metadata: {
        deletedProviderId: id,
        name: existingProvider.name,
      },
      ipAddress: extractIpAddress(request),
    });

    const managementUrl = env.CLIPROXYAPI_MANAGEMENT_URL;
    const secretKey = env.MANAGEMENT_API_KEY;

    let syncStatus: "ok" | "failed" = "ok";
    let syncMessage: string | undefined;

    if (secretKey) {
      try {
        const getRes = await fetchWithTimeout(`${managementUrl}/openai-compatibility`, {
          headers: { "Authorization": `Bearer ${secretKey}` }
        });
        
        if (getRes.ok) {
          const configData = (await getRes.json()) as Record<string, unknown>;
          const openAiCompatibility = configData["openai-compatibility"];
          const currentList: ManagementProviderEntry[] = Array.isArray(openAiCompatibility)
            ? openAiCompatibility.filter(isManagementProviderEntry)
            : [];

          const newList = currentList.filter((entry) => entry.name !== existingProvider.providerId);

          const putRes = await fetchWithTimeout(`${managementUrl}/openai-compatibility`, {
            method: "PUT",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${secretKey}` 
            },
            body: JSON.stringify(newList)
          });

          if (!putRes.ok) {
            syncStatus = "failed";
            syncMessage = "Backend sync failed - provider deleted but may still work temporarily";
            logger.error({ statusCode: putRes.status }, "Failed to sync deleted custom provider to Management API");
          } else {
            invalidateProxyModelsCache();
          }
        } else {
          syncStatus = "failed";
          syncMessage = "Backend sync failed - provider deleted but may still work temporarily";
          logger.error({ statusCode: getRes.status }, "Failed to fetch current config from Management API");
        }
      } catch (syncError) {
        syncStatus = "failed";
        syncMessage = "Backend sync failed - provider deleted but may still work temporarily";
        logger.error({ err: syncError }, "Failed to sync deleted custom provider to Management API");
      }
    } else {
      syncStatus = "failed";
      syncMessage = "Backend sync unavailable - management API key not configured";
    }

    return NextResponse.json({ success: true, syncStatus, syncMessage });

  } catch (error) {
    logger.error({ err: error }, "DELETE /api/custom-providers/[id] error");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
