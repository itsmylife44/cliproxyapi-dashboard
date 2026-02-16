import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { hashProviderKey } from "@/lib/providers/hash";
import { z } from "zod";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { syncCustomProviderToProxy } from "@/lib/providers/custom-provider-sync";
import { CreateCustomProviderSchema } from "@/lib/validation/schemas";

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
    logger.error({ err: error }, "GET /api/custom-providers error");
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

    const { syncStatus, syncMessage } = await syncCustomProviderToProxy({
      providerId: provider.providerId,
      prefix: provider.prefix,
      baseUrl: provider.baseUrl,
      apiKey: validated.apiKey,
      proxyUrl: provider.proxyUrl,
      headers: provider.headers as Record<string, string> | null,
      models: provider.models,
      excludedModels: provider.excludedModels
    }, "create");

    return NextResponse.json({ provider, syncStatus, syncMessage }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    logger.error({ err: error }, "POST /api/custom-providers error");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
