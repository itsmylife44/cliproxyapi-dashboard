import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { Errors } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { syncCustomProviderToProxy } from "@/lib/providers/custom-provider-sync";
import { hashProviderKey } from "@/lib/providers/hash";
import { logger } from "@/lib/logger";

const REQUIRED_COOKIE_KEYS = ["next-auth.session-token"];

const SIDECAR_BASE_URL = "http://perplexity-sidecar:8766/v1";
const SIDECAR_FETCH_TIMEOUT_MS = 5_000;

interface SidecarModel {
  id: string;
}

async function fetchSidecarModels(): Promise<Array<{ upstreamName: string; alias: string }>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SIDECAR_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${SIDECAR_BASE_URL}/models`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Sidecar /v1/models returned ${res.status}`);
    const data: { data?: SidecarModel[] } = await res.json();
    const models = data.data ?? [];
    if (models.length === 0) throw new Error("Sidecar returned empty model list");
    return models.map((m) => ({ upstreamName: m.id, alias: m.id }));
  } finally {
    clearTimeout(timeoutId);
  }
}

async function syncPerplexityProvider(
  userId: string
): Promise<{ created: boolean; modelsUpdated: number }> {
  const models = await fetchSidecarModels();

  const existingProvider = await prisma.customProvider.findUnique({
    where: { providerId: "perplexity-pro" },
    include: { models: true },
  });

  if (!existingProvider) {
    await prisma.customProvider.create({
      data: {
        userId,
        providerId: "perplexity-pro",
        name: "Perplexity Pro",
        baseUrl: SIDECAR_BASE_URL,
        apiKeyHash: hashProviderKey("sk-perplexity-sidecar"),
        prefix: null,
        proxyUrl: null,
        headers: {},
        models: { create: models },
        excludedModels: { create: [] },
      },
    });

    await syncCustomProviderToProxy(
      {
        providerId: "perplexity-pro",
        baseUrl: SIDECAR_BASE_URL,
        apiKey: "sk-perplexity-sidecar",
        models,
        excludedModels: [],
      },
      "create"
    );

    return { created: true, modelsUpdated: models.length };
  }

  if (existingProvider.userId !== userId) {
    return { created: false, modelsUpdated: 0 };
  }

  const existingNames = new Set(existingProvider.models.map((m) => m.upstreamName));
  const sidecarNames = new Set(models.map((m) => m.upstreamName));
  const hasChanges =
    existingNames.size !== sidecarNames.size ||
    models.some((m) => !existingNames.has(m.upstreamName));

  if (!hasChanges) {
    return { created: false, modelsUpdated: 0 };
  }

  await prisma.$transaction(async (tx) => {
    await tx.customProviderModel.deleteMany({
      where: { customProviderId: existingProvider.id },
    });
    await tx.customProvider.update({
      where: { id: existingProvider.id },
      data: { models: { create: models } },
    });
  });

  await syncCustomProviderToProxy(
    {
      providerId: "perplexity-pro",
      baseUrl: SIDECAR_BASE_URL,
      apiKey: "sk-perplexity-sidecar",
      models,
      excludedModels: [],
    },
    "update"
  );

  return { created: false, modelsUpdated: models.length };
}

function isValidCookieJson(raw: string): { valid: boolean; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, error: "Invalid JSON" };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { valid: false, error: "Must be a JSON object" };
  }

  const obj = parsed as Record<string, unknown>;
  const missing = REQUIRED_COOKIE_KEYS.filter(
    (key) => typeof obj[key] !== "string" || !(obj[key] as string).trim()
  );

  if (missing.length > 0) {
    return { valid: false, error: `Missing required keys: ${missing.join(", ")}` };
  }

  return { valid: true };
}

export async function GET() {
  const session = await verifySession();
  if (!session) return Errors.unauthorized();

  try {
    const cookies = await prisma.perplexityCookie.findMany({
      where: { userId: session.userId },
      select: {
        id: true,
        label: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ cookies });
  } catch (error) {
    return Errors.internal("fetch perplexity cookies", error);
  }
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) return Errors.unauthorized();

  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Errors.validation("Invalid request body");
    }

    const { cookieData, label } = body as Record<string, unknown>;

    if (typeof cookieData !== "string" || !cookieData.trim()) {
      return Errors.missingFields(["cookieData"]);
    }

    const cookieValidation = isValidCookieJson(cookieData);
    if (!cookieValidation.valid) {
      return Errors.validation(`Invalid cookie data: ${cookieValidation.error}`);
    }

    await prisma.perplexityCookie.updateMany({
      where: { userId: session.userId, isActive: true },
      data: { isActive: false },
    });

    const cookie = await prisma.perplexityCookie.create({
      data: {
        userId: session.userId,
        cookieData: cookieData.trim(),
        label: typeof label === "string" && label.trim() ? label.trim() : "Default",
        isActive: true,
      },
      select: {
        id: true,
        label: true,
        isActive: true,
        createdAt: true,
      },
    });

    let providerProvisioned = false;
    let modelsUpdated = 0;

    try {
      const result = await syncPerplexityProvider(session.userId);
      providerProvisioned = result.created;
      modelsUpdated = result.modelsUpdated;
    } catch (error) {
      logger.error(
        { err: error, userId: session.userId },
        "Failed to sync perplexity-pro custom provider"
      );
    }

    return NextResponse.json({ cookie, providerProvisioned, modelsUpdated }, { status: 201 });
  } catch (error) {
    return Errors.internal("save perplexity cookie", error);
  }
}

export async function DELETE(request: NextRequest) {
  const session = await verifySession();
  if (!session) return Errors.unauthorized();

  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Errors.validation("Invalid request body");
    }

    const { id } = body as Record<string, unknown>;

    if (typeof id !== "string") {
      return Errors.missingFields(["id"]);
    }

    const existing = await prisma.perplexityCookie.findFirst({
      where: { id, userId: session.userId },
    });

    if (!existing) {
      return Errors.notFound("Perplexity cookie");
    }

    await prisma.perplexityCookie.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return Errors.internal("delete perplexity cookie", error);
  }
}
