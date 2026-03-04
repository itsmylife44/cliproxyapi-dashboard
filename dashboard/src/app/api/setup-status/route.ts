import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getInternalProxyUrl } from "@/lib/config-generators/opencode";
import { fetchProxyModels } from "@/lib/config-generators/shared";

const CLIPROXYAPI_MANAGEMENT_URL =
  process.env.CLIPROXYAPI_MANAGEMENT_URL ||
  "http://cliproxyapi:8317/v0/management";

const MANAGEMENT_API_KEY = process.env.MANAGEMENT_API_KEY ?? "";

interface SetupStatusResponse {
  providers: number;
  apiKeys: number;
  models: number;
}

interface OAuthFilesResponse {
  files: Array<{
    id?: string;
    name?: string;
    type?: string;
    provider?: string;
    disabled?: boolean;
  }>;
}

async function fetchProviderCount(): Promise<number> {
  try {
    const [configRes, oauthRes] = await Promise.allSettled([
      fetch(`${CLIPROXYAPI_MANAGEMENT_URL}/config`, {
        headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
        cache: "no-store",
      }),
      fetch(`${CLIPROXYAPI_MANAGEMENT_URL}/auth-files`, {
        headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
        cache: "no-store",
      }),
    ]);

    let configProviderCount = 0;
    if (configRes.status === "fulfilled" && configRes.value.ok) {
      const config = (await configRes.value.json()) as Record<string, unknown>;
      const providerKeys = [
        "gemini-api-key",
        "claude-api-key",
        "codex-api-key",
        "vertex-api-key",
        "openai-compatibility",
      ];
      configProviderCount = providerKeys.filter((key) => {
        const value = config[key];
        if (Array.isArray(value)) return value.length > 0;
        return Boolean(value);
      }).length;
    }

    const activeOAuthProviders = new Set<string>();
    if (oauthRes.status === "fulfilled" && oauthRes.value.ok) {
      const oauthData = (await oauthRes.value.json()) as OAuthFilesResponse;
      if (Array.isArray(oauthData.files)) {
        for (const account of oauthData.files) {
          if (!account.disabled) {
            const provider = account.provider ?? account.type;
            if (provider) activeOAuthProviders.add(provider);
          }
        }
      }
    }

    return configProviderCount + activeOAuthProviders.size;
  } catch {
    return 0;
  }
}

export async function GET(): Promise<NextResponse> {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [apiKeyCount, providerCount] = await Promise.all([
    prisma.userApiKey.count({ where: { userId: session.userId } }),
    fetchProviderCount(),
  ]);

  let modelCount = 0;
  if (apiKeyCount > 0) {
    const firstKey = await prisma.userApiKey.findFirst({
      where: { userId: session.userId },
      select: { key: true },
    });
    if (firstKey) {
      const models = await fetchProxyModels(getInternalProxyUrl(), firstKey.key);
      modelCount = models.length;
    }
  }

  const response: SetupStatusResponse = {
    providers: providerCount,
    apiKeys: apiKeyCount,
    models: modelCount,
  };

  return NextResponse.json(response);
}
