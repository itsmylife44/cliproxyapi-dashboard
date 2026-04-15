import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import {
  pickBestModel,
  AGENT_ROLES,
  CATEGORY_ROLES,
} from "@/lib/config-generators/oh-my-opencode";
import { getInternalProxyUrl, extractOAuthModelAliases } from "@/lib/config-generators/opencode";
import { buildAvailableModelIds, fetchProxyModels } from "@/lib/config-generators/shared";
import type { ConfigData } from "@/lib/config-generators/shared";
import type { OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";
import { validateFullConfig } from "@/lib/config-generators/oh-my-opencode-types";
import { z } from "zod";
import { AgentConfigSchema } from "@/lib/validation/schemas";
import { Errors, apiSuccess } from "@/lib/errors";

async function fetchManagementJson(path: string) {
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
    if (!res.ok) {
      await res.body?.cancel();
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}

function extractOAuthAccounts(data: unknown): { id: string; name: string; type?: string; provider?: string; disabled?: boolean }[] {
  if (typeof data !== "object" || data === null) return [];
  const record = data as Record<string, unknown>;
  const files = record["files"];
  if (!Array.isArray(files)) return [];
  return files
    .filter(
      (entry): entry is Record<string, unknown> =>
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

function computeDefaults(
  availableModels: string[]
): { agents: Record<string, string>; categories: Record<string, string> } {
  const agents: Record<string, string> = {};
  for (const [agent, role] of Object.entries(AGENT_ROLES)) {
    const model = pickBestModel(availableModels, role.tier);
    if (model) {
      agents[agent] = model;
    }
  }

  const categories: Record<string, string> = {};
  for (const [category, role] of Object.entries(CATEGORY_ROLES)) {
    const model = pickBestModel(availableModels, role.tier);
    if (model) {
      categories[category] = model;
    }
  }

  return { agents, categories };
}

export async function GET() {
  try {
    const session = await verifySession();
    if (!session) {
      return Errors.unauthorized();
    }

    const [agentOverride, managementConfig, authFilesData, modelPreference] =
      await Promise.all([
        prisma.agentModelOverride.findUnique({
          where: { userId: session.userId },
        }),
        fetchManagementJson("config"),
        fetchManagementJson("auth-files"),
        prisma.modelPreference.findUnique({
          where: { userId: session.userId },
        }),
      ]);

    const excludedModels = new Set(modelPreference?.excludedModels || []);

    const userApiKeys = await prisma.userApiKey.findMany({
      where: { userId: session.userId },
      select: { key: true },
      take: 1,
    });
    const apiKeyForProxy = userApiKeys[0]?.key || "";
    const proxyModels = apiKeyForProxy ? await fetchProxyModels(getInternalProxyUrl(), apiKeyForProxy) : [];
    const oauthAccounts = extractOAuthAccounts(authFilesData);
    const oauthAliasIds = Object.keys(extractOAuthModelAliases(managementConfig as ConfigData | null, oauthAccounts));
    const allModelIds = buildAvailableModelIds(proxyModels, oauthAliasIds);
    const availableModels = allModelIds.filter((id: string) => !excludedModels.has(id));

    const defaults = computeDefaults(availableModels);
    const overrides = agentOverride?.overrides ? validateFullConfig(agentOverride.overrides) : {} as OhMyOpenCodeFullConfig;

    return NextResponse.json({
      overrides,
      availableModels,
      defaults,
    });
  } catch (error) {
    return Errors.internal("Get agent config error", error);
  }
}

/**
 * Deep merge for overrides objects.
 * - Objects are recursively merged
 * - Arrays are replaced (not merged)
 * - Primitives from source overwrite target
 */
function deepMergeOverrides(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];

    if (
      sourceVal !== null &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      // Both are plain objects - recurse
      result[key] = deepMergeOverrides(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      );
    } else {
      // Arrays, primitives, or mismatched types - replace
      result[key] = sourceVal;
    }
  }

  return result;
}

export async function PUT(request: NextRequest) {
  try {
    const session = await verifySession();
    if (!session) {
      return Errors.unauthorized();
    }

    const originError = validateOrigin(request);
    if (originError) {
      return originError;
    }

    const body = await request.json();
    const parsed = AgentConfigSchema.parse(body);

    const validated = validateFullConfig(parsed.overrides);

    // Fetch existing overrides to merge with
    const existing = await prisma.agentModelOverride.findUnique({
      where: { userId: session.userId },
    });

    const existingOverrides = (existing?.overrides as Record<string, unknown>) ?? {};

    // Deep merge: preserve fields not being updated (e.g., mcpServers from OpenCode UI)
    const mergedOverrides = deepMergeOverrides(
      existingOverrides,
      validated as unknown as Record<string, unknown>
    );

    const agentOverride = await prisma.agentModelOverride.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        overrides: JSON.parse(JSON.stringify(mergedOverrides)),
      },
      update: {
        overrides: JSON.parse(JSON.stringify(mergedOverrides)),
      },
    });

    return apiSuccess({
      overrides: agentOverride.overrides as Record<string, unknown>,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Errors.zodValidation(error.issues);
    }
    return Errors.internal("Update agent config error", error);
  }
}
