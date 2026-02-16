import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { generateApiKey } from "@/lib/api-keys/generate";
import { syncKeysToCliProxyApi } from "@/lib/api-keys/sync";
import { prisma } from "@/lib/db";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { logger } from "@/lib/logger";
import { z } from "zod";

interface ApiKeyResponse {
  id: string;
  name: string;
  keyPreview: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const CreateApiKeyRequestSchema = z.object({
  name: z.string().optional()
});

interface CreateApiKeyResponse {
  id: string;
  key: string;
  name: string;
  createdAt: string;
  syncStatus: "ok" | "failed" | "pending";
  syncMessage?: string;
}

function maskApiKey(key: string): string {
  if (key.length < 12) return "sk-xxxx...xxxx";
  const prefix = key.slice(0, 7);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const apiKeys = await prisma.userApiKey.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        key: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });

    const response: ApiKeyResponse[] = apiKeys.map((apiKey) => ({
      id: apiKey.id,
      name: apiKey.name,
      keyPreview: maskApiKey(apiKey.key),
      createdAt: apiKey.createdAt.toISOString(),
      lastUsedAt: apiKey.lastUsedAt?.toISOString() || null,
    }));

    return NextResponse.json({ apiKeys: response });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch API keys");
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimitWithPreset(request, "api-keys", "API_KEYS");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many API key creation requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const body = await request.json();
    const parsed = CreateApiKeyRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 }
      );
    }

    const key = generateApiKey();
    const name = parsed.data.name && parsed.data.name.trim() ? parsed.data.name.trim() : "Default";

    const apiKey = await prisma.userApiKey.create({
      data: {
        userId: session.userId,
        key,
        name,
      },
    });

    syncKeysToCliProxyApi().then((result) => {
      if (!result.ok) {
        logger.error({ error: result.error }, "Background sync failed after API key creation");
      }
    }).catch((err) => {
      logger.error({ err }, "Background sync threw unexpected error after API key creation");
    });

    const response: CreateApiKeyResponse = {
      id: apiKey.id,
      key: apiKey.key,
      name: apiKey.name,
      createdAt: apiKey.createdAt.toISOString(),
      syncStatus: "pending",
      syncMessage: "Key created - backend sync in progress",
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "Failed to create API key");
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid id parameter" },
        { status: 400 }
      );
    }

    const existingKey = await prisma.userApiKey.findFirst({
      where: {
        id,
        userId: session.userId,
      },
      select: { id: true },
    });

    if (!existingKey) {
      return NextResponse.json(
        { error: "API key not found or access denied" },
        { status: 404 }
      );
    }

    await prisma.userApiKey.delete({
      where: { id },
    });

    const syncResult = await syncKeysToCliProxyApi();
    if (!syncResult.ok) {
      logger.error({ error: syncResult.error }, "Sync failed after API key deletion");
    }

    return NextResponse.json({
      success: true,
      syncStatus: syncResult.ok ? "ok" : "failed",
      syncMessage: syncResult.ok ? undefined : "Backend sync pending - key deleted but may still work temporarily",
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete API key");
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    );
  }
}
