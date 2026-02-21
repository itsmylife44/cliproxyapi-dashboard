import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { Errors } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { syncCustomProviderToProxy } from "@/lib/providers/custom-provider-sync";
import { hashProviderKey } from "@/lib/providers/hash";

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

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) return Errors.unauthorized();

  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const models = await fetchSidecarModels();

    const existingProvider = await prisma.customProvider.findUnique({
      where: { providerId: "perplexity-pro" },
      include: { models: true },
    });

    if (!existingProvider) {
      await prisma.customProvider.create({
        data: {
          userId: session.userId,
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

      return NextResponse.json({
        synced: true,
        created: true,
        modelCount: models.length,
        models: models.map((m) => m.upstreamName),
      });
    }

    if (existingProvider.userId !== session.userId) {
      return Errors.forbidden();
    }

    const existingNames = new Set(existingProvider.models.map((m) => m.upstreamName));
    const hasChanges =
      existingNames.size !== models.length ||
      models.some((m) => !existingNames.has(m.upstreamName));

    if (!hasChanges) {
      return NextResponse.json({
        synced: true,
        created: false,
        modelCount: models.length,
        models: models.map((m) => m.upstreamName),
        message: "Models already up to date",
      });
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

    const added = models.filter((m) => !existingNames.has(m.upstreamName));
    const removed = [...existingNames].filter(
      (name) => !models.some((m) => m.upstreamName === name)
    );

    return NextResponse.json({
      synced: true,
      created: false,
      modelCount: models.length,
      models: models.map((m) => m.upstreamName),
      added: added.map((m) => m.upstreamName),
      removed,
    });
  } catch (error) {
    return Errors.internal("sync perplexity models", error);
  }
}
