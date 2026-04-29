import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { hashProviderKey } from "@/lib/providers/hash";
import { encryptProviderKey } from "@/lib/providers/encrypt";
import { z } from "zod";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";
import { syncCustomProviderToProxy } from "@/lib/providers/custom-provider-sync";
import { CreateCustomProviderSchema } from "@/lib/validation/schemas";
import { Errors } from "@/lib/errors";
import { isUserAdmin } from "@/lib/auth/admin";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  try {
    const isAdmin = await isUserAdmin(session.userId);
    const providers = await prisma.customProvider.findMany({
      where: {
        OR: [
          { userId: session.userId },
          { isShared: true }
        ]
      },
      include: {
        models: true,
        excludedModels: true,
        user: { select: { id: true, username: true } }
      },
      orderBy: { sortOrder: "asc" }
    });

    return NextResponse.json({
      providers: providers.map(p => {
        const isOwn = p.userId === session.userId;
        const canSeeSecrets = isOwn || isAdmin;
        const rawHeaders = (p.headers ?? {}) as Record<string, string>;
        return {
          id: p.id,
          name: p.name,
          providerId: p.providerId,
          baseUrl: p.baseUrl,
          prefix: p.prefix,
          proxyUrl: p.proxyUrl,
          groupId: p.groupId,
          sortOrder: p.sortOrder,
          // Redact headers for non-owner non-admin viewers — they can contain
          // Authorization tokens and other secrets. Admins keep visibility so
          // they can meaningfully edit a shared provider they don't own.
          headers: canSeeSecrets ? p.headers : {},
          hasHeaders: Object.keys(rawHeaders).length > 0,
          models: p.models,
          excludedModels: p.excludedModels,
          hasEncryptedKey: p.apiKeyEncrypted !== null,
          isShared: p.isShared,
          isOwn,
          ownerId: p.user.id,
          ownerUsername: p.user.username,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      })
    });
  } catch (error) {
    return Errors.internal("GET /api/custom-providers error", error);
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimitWithPreset(request, "custom-providers", "CUSTOM_PROVIDERS");
  if (!rateLimit.allowed) {
    return Errors.rateLimited(rateLimit.retryAfterSeconds);
  }

  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const body = await request.json();
    const validated = CreateCustomProviderSchema.parse(body);

    if (validated.isShared === true) {
      const isAdmin = await isUserAdmin(session.userId);
      if (!isAdmin) {
        return Errors.forbidden();
      }
    }

    const existingName = await prisma.customProvider.findFirst({
      where: { 
        userId: session.userId,
        name: validated.name
      }
    });

    if (existingName) {
      return Errors.conflict("Provider name already exists");
    }

    const existingId = await prisma.customProvider.findUnique({
      where: { providerId: validated.providerId }
    });

    if (existingId) {
      return Errors.conflict("Provider ID already taken");
    }

    const provider = await prisma.customProvider.create({
      data: {
        userId: session.userId,
        name: validated.name,
        providerId: validated.providerId,
        baseUrl: validated.baseUrl,
        apiKeyHash: validated.apiKey ? hashProviderKey(validated.apiKey) : null,
        apiKeyEncrypted: validated.apiKey ? (encryptProviderKey(validated.apiKey) ?? undefined) : null,
        prefix: validated.prefix,
        proxyUrl: validated.proxyUrl,
        headers: validated.headers ? (validated.headers as Record<string, string>) : {},
        isShared: validated.isShared === true,
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
      apiKey: validated.apiKey ?? "",
      proxyUrl: provider.proxyUrl,
      headers: provider.headers as Record<string, string> | null,
      models: provider.models,
      excludedModels: provider.excludedModels
    }, "create");

    return NextResponse.json({ provider, syncStatus, syncMessage }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return Errors.zodValidation(error.issues);
    }
    return Errors.internal("POST /api/custom-providers error", error);
  }
}
