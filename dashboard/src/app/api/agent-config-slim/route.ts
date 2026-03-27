import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { pickBestModel, SLIM_AGENT_ROLES } from "@/lib/config-generators/oh-my-opencode-slim";
import { getInternalProxyUrl, extractOAuthModelAliases } from "@/lib/config-generators/opencode";
import { fetchProxyModels } from "@/lib/config-generators/shared";
import type { ConfigData } from "@/lib/config-generators/shared";
import type { OhMyOpenCodeSlimFullConfig } from "@/lib/config-generators/oh-my-opencode-slim-types";
import { validateSlimConfig } from "@/lib/config-generators/oh-my-opencode-slim-types";
import { z } from "zod";
import { SlimAgentConfigSchema } from "@/lib/validation/schemas";
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

function computeSlimDefaults(
  availableModels: string[],
): Record<string, string> {
  const agents: Record<string, string> = {};
  for (const [agent, role] of Object.entries(SLIM_AGENT_ROLES)) {
    const model = pickBestModel(availableModels, role.tier);
    if (model) {
      agents[agent] = model;
    }
  }
  return agents;
}

export async function GET() {
  try {
    const session = await verifySession();
    if (!session) {
      return Errors.unauthorized();
    }

    const [agentOverride, managementConfig, authFilesData, modelPreference, userApiKeys] =
      await Promise.all([
        prisma.agentModelOverride.findUnique({
          where: { userId: session.userId },
        }),
        fetchManagementJson("config"),
        fetchManagementJson("auth-files"),
        prisma.modelPreference.findUnique({
          where: { userId: session.userId },
        }),
        prisma.userApiKey.findMany({
          where: { userId: session.userId },
          select: { key: true },
          take: 1,
        }),
      ]);

    const excludedModels = new Set(modelPreference?.excludedModels || []);
    const apiKeyForProxy = userApiKeys[0]?.key || "";
    const proxyModels = apiKeyForProxy ? await fetchProxyModels(getInternalProxyUrl(), apiKeyForProxy) : [];
    const oauthAccounts = extractOAuthAccounts(authFilesData);
    const oauthAliasIds = Object.keys(extractOAuthModelAliases(managementConfig as ConfigData | null, oauthAccounts));
    const allModelIds = [...new Set([...proxyModels.map((m: { id: string }) => m.id), ...oauthAliasIds])];
    const availableModels = allModelIds
      .filter((id: string) => !excludedModels.has(id))
      .sort((a, b) => a.localeCompare(b));

    const defaults = computeSlimDefaults(availableModels);
    const overrides = agentOverride?.slimOverrides ? validateSlimConfig(agentOverride.slimOverrides) : {} as OhMyOpenCodeSlimFullConfig;

    return NextResponse.json({
      overrides,
      availableModels,
      defaults,
    });
  } catch (error) {
    return Errors.internal("Get slim agent config error", error);
  }
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
    const parsed = SlimAgentConfigSchema.parse(body);
    const validated = validateSlimConfig(parsed.overrides);

    const agentOverride = await prisma.agentModelOverride.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        slimOverrides: JSON.parse(JSON.stringify(validated)),
      },
      update: {
        slimOverrides: JSON.parse(JSON.stringify(validated)),
      },
    });

    return apiSuccess({
      overrides: agentOverride.slimOverrides as Record<string, unknown>,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Errors.zodValidation(error.issues);
    }
    return Errors.internal("Update slim agent config error", error);
  }
}
