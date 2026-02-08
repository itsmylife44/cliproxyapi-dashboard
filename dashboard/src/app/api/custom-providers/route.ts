import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { hashProviderKey } from "@/lib/providers/hash";
import { z } from "zod";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { invalidateProxyModelsCache } from "@/lib/cache";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";

const CreateCustomProviderSchema = z.object({
  name: z.string().min(1).max(100),
  providerId: z.string().regex(/^[a-z0-9-]+$/, "Provider ID must be lowercase alphanumeric with hyphens"),
  baseUrl: z.string().url().startsWith("https://", "Base URL must start with https://"),
  apiKey: z.string().min(1),
  prefix: z.string().optional(),
  proxyUrl: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  models: z.array(z.object({
    upstreamName: z.string().min(1),
    alias: z.string().min(1)
  })).min(1, "At least one model mapping is required"),
  excludedModels: z.array(z.string()).optional()
});

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const providers = await prisma.customProvider.findMany({
      where: { userId: session.userId },
      include: {
        models: true,
        excludedModels: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      providers: providers.map(p => ({
        id: p.id,
        name: p.name,
        providerId: p.providerId,
        baseUrl: p.baseUrl,
        prefix: p.prefix,
        proxyUrl: p.proxyUrl,
        headers: p.headers,
        models: p.models,
        excludedModels: p.excludedModels,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }))
    });
  } catch (error) {
    console.error("GET /api/custom-providers error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimitWithPreset(request, "custom-providers", "CUSTOM_PROVIDERS");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many custom provider creation requests. Try again later." },
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
  if (originError) return originError;

  try {
    const body = await request.json();
    const validated = CreateCustomProviderSchema.parse(body);

    const existingName = await prisma.customProvider.findFirst({
      where: { 
        userId: session.userId,
        name: validated.name
      }
    });

    if (existingName) {
      return NextResponse.json({ error: "Provider name already exists" }, { status: 409 });
    }

    const existingId = await prisma.customProvider.findUnique({
      where: { providerId: validated.providerId }
    });

    if (existingId) {
      return NextResponse.json({ error: "Provider ID already taken" }, { status: 409 });
    }

    const provider = await prisma.customProvider.create({
      data: {
        userId: session.userId,
        name: validated.name,
        providerId: validated.providerId,
        baseUrl: validated.baseUrl,
        apiKeyHash: hashProviderKey(validated.apiKey),
        prefix: validated.prefix,
        proxyUrl: validated.proxyUrl,
        headers: validated.headers ? (validated.headers as Record<string, string>) : {},
        models: {
          create: validated.models.map(m => ({
            upstreamName: m.upstreamName,
            alias: m.alias
          }))
        },
        excludedModels: {
          create: validated.excludedModels?.map(p => ({ pattern: p })) || []
        }
      },
      include: {
        models: true,
        excludedModels: true
      }
    });

    const managementUrl = process.env.CLIPROXYAPI_MANAGEMENT_URL || "http://cliproxyapi:8317/v0/management";
    const secretKey = process.env.MANAGEMENT_API_KEY;

    logAuditAsync({
      userId: session.userId,
      action: AUDIT_ACTION.CUSTOM_PROVIDER_CREATED,
      target: validated.providerId,
      metadata: {
        providerId: provider.id,
        name: validated.name,
        baseUrl: validated.baseUrl,
        modelCount: validated.models.length,
      },
      ipAddress: extractIpAddress(request),
    });

    let syncStatus: "ok" | "failed" = "ok";
    let syncMessage: string | undefined;

    if (secretKey) {
      try {
        const getRes = await fetch(`${managementUrl}/openai-compatibility`, {
          headers: { "Authorization": `Bearer ${secretKey}` }
        });
        
        if (getRes.ok) {
          const configData = await getRes.json();
          const currentList = configData["openai-compatibility"] || [];

          const newEntry = {
            name: validated.providerId,
            prefix: validated.prefix,
            "base-url": validated.baseUrl,
            "api-key-entries": [{ 
              "api-key": validated.apiKey,
              ...(validated.proxyUrl ? { "proxy-url": validated.proxyUrl } : {})
            }],
            models: validated.models.map(m => ({ name: m.upstreamName, alias: m.alias })),
            "excluded-models": validated.excludedModels || [],
            ...(validated.headers ? { headers: validated.headers } : {})
          };

          const newList = [...currentList, newEntry];

          const putRes = await fetch(`${managementUrl}/openai-compatibility`, {
            method: "PUT",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${secretKey}` 
            },
            body: JSON.stringify(newList)
          });

          if (!putRes.ok) {
            syncStatus = "failed";
            syncMessage = "Backend sync failed - provider created but may not work immediately";
            console.error("Failed to sync custom provider to Management API: HTTP", putRes.status);
          } else {
            invalidateProxyModelsCache();
          }
        } else {
          syncStatus = "failed";
          syncMessage = "Backend sync failed - provider created but may not work immediately";
          console.error("Failed to fetch current config from Management API: HTTP", getRes.status);
        }
      } catch (syncError) {
        syncStatus = "failed";
        syncMessage = "Backend sync failed - provider created but may not work immediately";
        console.error("Failed to sync custom provider to Management API:", syncError);
      }
    } else {
      syncStatus = "failed";
      syncMessage = "Backend sync unavailable - management API key not configured";
    }

    return NextResponse.json({ provider, syncStatus, syncMessage }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("POST /api/custom-providers error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
