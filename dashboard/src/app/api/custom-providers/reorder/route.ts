import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { ReorderCustomProvidersSchema } from "@/lib/validation/schemas";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";
import { env } from "@/lib/env";
import { invalidateProxyModelsCache } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { z } from "zod";

const FETCH_TIMEOUT_MS = 10_000;

interface ManagementProviderEntry {
  name?: string;
  [key: string]: unknown;
}

function isManagementProviderEntry(value: unknown): value is ManagementProviderEntry {
  return typeof value === "object" && value !== null;
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function PUT(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const body = await request.json();
    const validated = ReorderCustomProvidersSchema.parse(body);
    const uniqueProviderIds = new Set(validated.providerIds);

    if (uniqueProviderIds.size !== validated.providerIds.length) {
      return Errors.validation("providerIds must not contain duplicates");
    }

    const providers = await prisma.customProvider.findMany({
      where: {
        userId: session.userId,
        id: { in: validated.providerIds },
      },
      select: {
        id: true,
        providerId: true,
      },
    });

    if (providers.length !== validated.providerIds.length) {
      return Errors.validation("One or more providers do not belong to the current user");
    }

    await prisma.$transaction(
      validated.providerIds.map((providerId, index) =>
        prisma.customProvider.update({
          where: { id: providerId },
          data: { sortOrder: index },
        })
      )
    );

    let syncStatus: "ok" | "failed" = "ok";

    const managementUrl = env.CLIPROXYAPI_MANAGEMENT_URL;
    const secretKey = env.MANAGEMENT_API_KEY;

    // Defensive: MANAGEMENT_API_KEY is required in env.ts, but guard matches existing routes
    if (!secretKey) {
      syncStatus = "failed";
    } else {
      const orderedProviders = validated.providerIds
        .map((providerId) => providers.find((provider) => provider.id === providerId))
        .filter((provider): provider is { id: string; providerId: string } => provider !== undefined);

      try {
        const getRes = await fetchWithTimeout(`${managementUrl}/openai-compatibility`, {
          headers: { Authorization: `Bearer ${secretKey}` },
        });

        if (!getRes.ok) {
          await getRes.body?.cancel();
          syncStatus = "failed";
        } else {
          const configData = (await getRes.json()) as Record<string, unknown>;
          const openAiCompatibility = configData["openai-compatibility"];
          const currentList: ManagementProviderEntry[] = Array.isArray(openAiCompatibility)
            ? openAiCompatibility.filter(isManagementProviderEntry)
            : [];

          const entryByName = new Map<string, ManagementProviderEntry>();
          for (const entry of currentList) {
            if (entry.name) {
              entryByName.set(entry.name, entry);
            }
          }

          const orderedEntries = orderedProviders
            .map((provider) => entryByName.get(provider.providerId))
            .filter((entry): entry is ManagementProviderEntry => entry !== undefined);

          const orderedNames = new Set(
            orderedProviders.map((provider) => provider.providerId)
          );
          const untouchedEntries = currentList.filter((entry) => !orderedNames.has(entry.name ?? ""));
          const reorderedList = [...orderedEntries, ...untouchedEntries];

          const putRes = await fetchWithTimeout(`${managementUrl}/openai-compatibility`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${secretKey}`,
            },
            body: JSON.stringify(reorderedList),
          });

          if (!putRes.ok) {
            await putRes.body?.cancel();
            syncStatus = "failed";
          } else {
            invalidateProxyModelsCache();
          }
        }
      } catch (syncError) {
        logger.error({ err: syncError }, "Failed to sync custom provider reorder to Management API");
        syncStatus = "failed";
      }
    }

    logAuditAsync({
      userId: session.userId,
      action: AUDIT_ACTION.CUSTOM_PROVIDER_REORDERED,
      target: session.userId,
      metadata: {
        providerIds: validated.providerIds,
      },
      ipAddress: extractIpAddress(request),
    });

    return NextResponse.json({ success: true, syncStatus });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Errors.zodValidation(error.issues);
    }
    return Errors.internal("PUT /api/custom-providers/reorder", error);
  }
}
