import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { syncKeysToCliProxyApi } from "@/lib/api-keys/sync";
import { Errors, apiSuccess } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return Errors.forbidden();
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const existingKeyCount = await prisma.userApiKey.count();
    if (existingKeyCount > 0) {
      return Errors.conflict(`Migration already completed (${existingKeyCount} existing keys)`);
    }

    const managementUrl =
      process.env.CLIPROXYAPI_MANAGEMENT_URL ||
      "http://cliproxyapi:8317/v0/management";
    const managementApiKey = process.env.MANAGEMENT_API_KEY;

    if (!managementApiKey) {
      logger.error("MANAGEMENT_API_KEY not set");
      return Errors.internal("Management API not configured");
    }

    const response = await fetch(`${managementUrl}/api-keys`, {
      headers: { Authorization: `Bearer ${managementApiKey}` },
      cache: "no-store",
    });

    if (!response.ok) {
      await response.body?.cancel();
      logger.error(
        { status: response.status },
        "Failed to fetch existing API keys"
      );
      return Errors.internal("Failed to fetch existing API keys from CLIProxyAPI");
    }

    const data = (await response.json()) as unknown;

    const apiKeysArray = Array.isArray((data as Record<string, unknown>)["api-keys"])
      ? ((data as Record<string, unknown>)["api-keys"] as string[])
      : [];

    const firstAdmin = await prisma.user.findFirst({
      where: { isAdmin: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!firstAdmin) {
      return Errors.validation("No admin user found in database");
    }

    if (apiKeysArray.length === 0) {
      return apiSuccess({
        keysAssigned: 0,
        userId: firstAdmin.id,
      });
    }

    await prisma.$transaction(async (tx) => {
      for (const key of apiKeysArray) {
        const existing = await tx.userApiKey.findUnique({
          where: { key },
        });

        if (!existing) {
          await tx.userApiKey.create({
            data: {
              userId: firstAdmin.id,
              key,
              name: "Migrated Key",
            },
          });
        }
      }
    });

    const syncResult = await syncKeysToCliProxyApi();
    if (!syncResult.ok) {
      logger.warn(
        { error: syncResult.error },
        "Sync after migration failed (keys are still in DB)"
      );
    }

    return apiSuccess({
      keysAssigned: apiKeysArray.length,
      userId: firstAdmin.id,
    });
  } catch (error) {
    return Errors.internal("Migration failed", error);
  }
}
