import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { generateApiKey } from "@/lib/api-keys/generate";
import { syncKeysToCliProxyApi } from "@/lib/api-keys/sync";
import { prisma } from "@/lib/db";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";

interface ApiKeyResponse {
  id: string;
  name: string;
  keyPreview: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface CreateApiKeyRequest {
  name?: string;
}

interface CreateApiKeyResponse {
  id: string;
  key: string;
  name: string;
  createdAt: string;
  syncStatus: "ok" | "failed";
  syncMessage?: string;
}

function maskApiKey(key: string): string {
  if (key.length < 12) return "sk-xxxx...xxxx";
  const prefix = key.slice(0, 7);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

function isCreateApiKeyRequest(body: unknown): body is CreateApiKeyRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) return true;
  
  const obj = body as Record<string, unknown>;
  
  if (obj.name !== undefined && typeof obj.name !== "string") return false;
  
  return true;
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
    console.error("Failed to fetch API keys:", error);
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
    
    if (!isCreateApiKeyRequest(body)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const key = generateApiKey();
    const name = body.name && body.name.trim() ? body.name.trim() : "Default";

    const apiKey = await prisma.userApiKey.create({
      data: {
        userId: session.userId,
        key,
        name,
      },
    });

    const syncResult = await syncKeysToCliProxyApi();
    if (!syncResult.ok) {
      console.error("Sync failed after API key creation:", syncResult.error);
    }

    const response: CreateApiKeyResponse = {
      id: apiKey.id,
      key: apiKey.key,
      name: apiKey.name,
      createdAt: apiKey.createdAt.toISOString(),
      syncStatus: syncResult.ok ? "ok" : "failed",
      syncMessage: syncResult.ok ? undefined : "Backend sync pending - key created but may not work immediately",
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Failed to create API key:", error);
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
      console.error("Sync failed after API key deletion:", syncResult.error);
    }

    return NextResponse.json({
      success: true,
      syncStatus: syncResult.ok ? "ok" : "failed",
      syncMessage: syncResult.ok ? undefined : "Backend sync pending - key deleted but may still work temporarily",
    });
  } catch (error) {
    console.error("Failed to delete API key:", error);
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    );
  }
}
