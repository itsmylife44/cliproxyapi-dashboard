import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { generateApiKey } from "@/lib/api-keys/generate";
import {
  getApiKeyUsageSummaries,
  invalidateApiKeyUsageCache,
  syncKeysToCliProxyApi,
} from "@/lib/api-keys/sync";
import { prisma } from "@/lib/db";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { Errors, apiSuccess } from "@/lib/errors";

interface ApiKeyResponse {
  id: string;
  name: string;
  keyPreview: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  spendLimit: number | null;
  totalSpend: number;
}

const NullableExpirySchema = z
  .union([z.string().trim(), z.null()])
  .optional()
  .transform((val, ctx) => {
    if (val === undefined) return undefined;
    if (val === null || val === "") return null;
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(val);
    const parsed = new Date(dateOnly ? `${val}T23:59:59.999Z` : val);
    if (Number.isNaN(parsed.getTime()) || (dateOnly && parsed.toISOString().slice(0, 10) !== val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid expiry date" });
      return z.NEVER;
    }
    return parsed;
  });

const NullableSpendLimitSchema = z
  .union([z.number().finite().nonnegative(), z.null()])
  .optional();

const CreateApiKeyRequestSchema = z.object({
  name: z.string().optional(),
  expiresAt: NullableExpirySchema,
  spendLimit: NullableSpendLimitSchema,
});

const UpdateApiKeyRequestSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
  expiresAt: NullableExpirySchema,
  spendLimit: NullableSpendLimitSchema,
});

interface CreateApiKeyResponse {
  id: string;
  key: string;
  name: string;
  createdAt: string;
  expiresAt: string | null;
  spendLimit: number | null;
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
    return Errors.unauthorized();
  }

  try {
    const apiKeys = await prisma.userApiKey.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        key: true,
        isActive: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        spendLimit: true,
      },
    });

    const usageByKey = await getApiKeyUsageSummaries(
      apiKeys.map((apiKey) => apiKey.id)
    );

    const response: ApiKeyResponse[] = apiKeys.map((apiKey) => {
      const usageSummary = usageByKey.get(apiKey.id);
      const usageTs = usageSummary?.lastUsedAt ?? null;
      const effectiveLastUsed =
        apiKey.lastUsedAt && usageTs
          ? usageTs > apiKey.lastUsedAt
            ? usageTs
            : apiKey.lastUsedAt
          : usageTs ?? apiKey.lastUsedAt;

      return {
        id: apiKey.id,
        name: apiKey.name,
        keyPreview: maskApiKey(apiKey.key),
        isActive: apiKey.isActive,
        createdAt: apiKey.createdAt.toISOString(),
        lastUsedAt: effectiveLastUsed?.toISOString() || null,
        expiresAt: apiKey.expiresAt?.toISOString() || null,
        spendLimit: apiKey.spendLimit ?? null,
        totalSpend: usageSummary?.totalSpend ?? 0,
      };
    });

    return NextResponse.json({ apiKeys: response });
  } catch (error) {
    return Errors.internal("Failed to fetch API keys", error);
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimitWithPreset(request, "api-keys", "API_KEYS");
  if (!rateLimit.allowed) {
    return Errors.rateLimited(rateLimit.retryAfterSeconds);
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
    const parsed = CreateApiKeyRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Errors.zodValidation(parsed.error.issues);
    }

    const key = generateApiKey();
    const name = parsed.data.name && parsed.data.name.trim() ? parsed.data.name.trim() : "Default";

    const apiKey = await prisma.userApiKey.create({
      data: {
        userId: session.userId,
        key,
        name,
        expiresAt: parsed.data.expiresAt ?? null,
        spendLimit: parsed.data.spendLimit ?? null,
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
      expiresAt: apiKey.expiresAt?.toISOString() || null,
      spendLimit: apiKey.spendLimit ?? null,
      syncStatus: "pending",
      syncMessage: "Key created - backend sync in progress",
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return Errors.internal("Failed to create API key", error);
  }
}

export async function PATCH(request: NextRequest) {
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
    const parsed = UpdateApiKeyRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Errors.zodValidation(parsed.error.issues);
    }

    const existingKey = await prisma.userApiKey.findFirst({
      where: {
        id: parsed.data.id,
        userId: session.userId,
      },
      select: { id: true },
    });

    if (!existingKey) {
      return Errors.notFound("API key");
    }

    const updated = await prisma.userApiKey.update({
      where: { id: parsed.data.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        ...(parsed.data.expiresAt !== undefined ? { expiresAt: parsed.data.expiresAt } : {}),
        ...(parsed.data.spendLimit !== undefined ? { spendLimit: parsed.data.spendLimit } : {}),
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        expiresAt: true,
        spendLimit: true,
      },
    });

    const syncResult = await syncKeysToCliProxyApi();
    if (!syncResult.ok) {
      logger.error({ error: syncResult.error }, "Sync failed after API key update");
    }

    return apiSuccess({
      id: updated.id,
      name: updated.name,
      isActive: updated.isActive,
      expiresAt: updated.expiresAt?.toISOString() || null,
      spendLimit: updated.spendLimit ?? null,
      syncStatus: syncResult.ok ? "ok" : ("failed" as const),
    });
  } catch (error) {
    return Errors.internal("Failed to update API key", error);
  }
}

export async function DELETE(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id || typeof id !== "string") {
      return Errors.missingFields(["id"]);
    }

    const existingKey = await prisma.userApiKey.findFirst({
      where: {
        id,
        userId: session.userId,
      },
      select: { id: true },
    });

    if (!existingKey) {
      return Errors.notFound("API key");
    }

    await prisma.userApiKey.delete({
      where: { id },
    });
    invalidateApiKeyUsageCache([id]);

    const syncResult = await syncKeysToCliProxyApi();
    if (!syncResult.ok) {
      logger.error({ error: syncResult.error }, "Sync failed after API key deletion");
    }

    return apiSuccess({
      syncStatus: syncResult.ok ? "ok" : ("failed" as const),
    });
  } catch (error) {
    return Errors.internal("Failed to delete API key", error);
  }
}
