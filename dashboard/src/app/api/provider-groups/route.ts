import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";
import { CreateProviderGroupSchema } from "@/lib/validation/schemas";
import { z } from "zod";

interface ProviderRecord {
  id: string;
  userId: string;
  groupId: string | null;
  sortOrder: number;
  name: string;
  providerId: string;
  baseUrl: string;
  apiKeyHash: string;
  prefix: string | null;
  proxyUrl: string | null;
  headers: unknown;
  createdAt: Date;
  updatedAt: Date;
  models: { id: string; customProviderId: string; upstreamName: string; alias: string }[];
  excludedModels: { id: string; customProviderId: string; pattern: string }[];
}

function sanitizeProvider(p: ProviderRecord) {
  return {
    id: p.id,
    name: p.name,
    providerId: p.providerId,
    baseUrl: p.baseUrl,
    prefix: p.prefix,
    proxyUrl: p.proxyUrl,
    groupId: p.groupId,
    sortOrder: p.sortOrder,
    headers: p.headers,
    models: p.models,
    excludedModels: p.excludedModels,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  try {
    const [groups, ungrouped] = await Promise.all([
      prisma.providerGroup.findMany({
        where: { userId: session.userId },
        include: {
          providers: {
            include: {
              models: true,
              excludedModels: true,
            },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.customProvider.findMany({
        where: {
          userId: session.userId,
          groupId: null,
        },
        include: {
          models: true,
          excludedModels: true,
        },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    const safeGroups = groups.map(group => ({
      ...group,
      providers: group.providers.map(sanitizeProvider),
    }));
    const safeUngrouped = ungrouped.map(sanitizeProvider);

    return NextResponse.json({ groups: safeGroups, ungrouped: safeUngrouped });
  } catch (error) {
    return Errors.internal("GET /api/provider-groups", error);
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimitWithPreset(request, "provider-groups", "CUSTOM_PROVIDERS");
  if (!rateLimit.allowed) {
    return Errors.rateLimited(rateLimit.retryAfterSeconds ?? 60);
  }

  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const body = await request.json();
    const validated = CreateProviderGroupSchema.parse(body);

    const existing = await prisma.providerGroup.findFirst({
      where: {
        userId: session.userId,
        name: validated.name,
      },
      select: { id: true },
    });

    if (existing) {
      return Errors.conflict("Provider group name already exists");
    }

    const aggregate = await prisma.providerGroup.aggregate({
      where: { userId: session.userId },
      _max: { sortOrder: true },
    });

    const group = await prisma.providerGroup.create({
      data: {
        userId: session.userId,
        name: validated.name,
        color: validated.color,
        sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
      },
    });

    logAuditAsync({
      userId: session.userId,
      action: AUDIT_ACTION.PROVIDER_GROUP_CREATED,
      target: group.id,
      metadata: {
        name: group.name,
        color: group.color,
      },
      ipAddress: extractIpAddress(request),
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Errors.zodValidation(error.issues);
    }
    return Errors.internal("POST /api/provider-groups", error);
  }
}
