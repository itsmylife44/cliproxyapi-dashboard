import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import {
  buildAvailableModelIds,
  pickBestModel,
  enrichTierForRole,
  AGENT_ROLES,
  CATEGORY_ROLES,
} from "@/lib/config-generators/oh-my-opencode";
import type { ConfigData, OAuthAccount, ModelsDevData } from "@/lib/config-generators/shared";
import type { OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";
import { validateFullConfig } from "@/lib/config-generators/oh-my-opencode-types";

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

async function fetchModelsDevData(): Promise<ModelsDevData | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("https://models.dev/api.json", {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function extractOAuthAccounts(data: unknown): OAuthAccount[] {
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
  availableModels: string[],
  modelsDevData: ModelsDevData | null
): { agents: Record<string, string>; categories: Record<string, string> } {
  const agents: Record<string, string> = {};
  for (const [agent, role] of Object.entries(AGENT_ROLES)) {
    const enrichedTier = enrichTierForRole(role.tier, modelsDevData);
    const model = pickBestModel(availableModels, enrichedTier);
    if (model) {
      agents[agent] = model;
    }
  }

  const categories: Record<string, string> = {};
  for (const [category, role] of Object.entries(CATEGORY_ROLES)) {
    const enrichedTier = enrichTierForRole(role.tier, modelsDevData);
    const model = pickBestModel(availableModels, enrichedTier);
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

    const [agentOverride, managementConfig, authFilesData, modelsDevData, modelPreference] =
      await Promise.all([
        prisma.agentModelOverride.findUnique({
          where: { userId: session.userId },
        }),
        fetchManagementJson("config"),
        fetchManagementJson("auth-files"),
        fetchModelsDevData(),
        prisma.modelPreference.findUnique({
          where: { userId: session.userId },
        }),
      ]);

    const oauthAccounts = extractOAuthAccounts(authFilesData);
    const excludedModels = new Set(modelPreference?.excludedModels || []);

    const allModelIds = buildAvailableModelIds(
      managementConfig as ConfigData | null,
      oauthAccounts,
      modelsDevData
    );
    const availableModels = allModelIds.filter((id) => !excludedModels.has(id));

    const defaults = computeDefaults(availableModels, modelsDevData);
    const overrides = agentOverride?.overrides ? validateFullConfig(agentOverride.overrides) : {} as OhMyOpenCodeFullConfig;

    return NextResponse.json({
      overrides,
      availableModels,
      defaults,
    });
  } catch (error) {
    console.error("Get agent config error:", error);
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

    if (typeof body.overrides !== "object" || body.overrides === null) {
      return NextResponse.json(
        { error: "overrides must be an object" },
        { status: 400 }
      );
    }

    const validated = validateFullConfig(body.overrides);

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
    console.error("Update agent config error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
