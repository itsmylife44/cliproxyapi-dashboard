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
import { fetchProxyModels } from "@/lib/config-generators/shared";
import type { ConfigData } from "@/lib/config-generators/shared";
import type { OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";
import { validateFullConfig } from "@/lib/config-generators/oh-my-opencode-types";
import { z } from "zod";
import { AgentConfigSchema, formatZodError } from "@/lib/validation/schemas";
import { logger } from "@/lib/logger";

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
    if (!res.ok) return null;
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const allModelIds = [...proxyModels.map((m: { id: string }) => m.id), ...oauthAliasIds];
    const availableModels = allModelIds.filter((id: string) => !excludedModels.has(id));

    const defaults = computeDefaults(availableModels);
    const overrides = agentOverride?.overrides ? validateFullConfig(agentOverride.overrides) : {} as OhMyOpenCodeFullConfig;

    return NextResponse.json({
      overrides,
      availableModels,
      defaults,
    });
  } catch (error) {
    logger.error({ err: error }, "Get agent config error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await verifySession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const originError = validateOrigin(request);
    if (originError) {
      return originError;
    }

    const body = await request.json();
    const parsed = AgentConfigSchema.parse(body);

    const validated = validateFullConfig(parsed.overrides);

    const agentOverride = await prisma.agentModelOverride.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        overrides: JSON.parse(JSON.stringify(validated)),
      },
      update: {
        overrides: JSON.parse(JSON.stringify(validated)),
      },
    });

    return NextResponse.json({
      success: true,
      overrides: agentOverride.overrides,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatZodError(error), { status: 400 });
    }
    logger.error({ err: error }, "Update agent config error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
