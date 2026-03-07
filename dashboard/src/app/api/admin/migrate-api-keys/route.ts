import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { syncKeysToCliProxyApi } from "@/lib/api-keys/sync";
import { logger } from "@/lib/logger";
import { apiSuccess, apiError } from "@/lib/api-response";

/**
 * POST /api/admin/migrate-api-keys
 *
 * One-time, idempotent migration endpoint to assign existing CLIProxyAPI keys
 * to the first admin user in the database.
 *
 * Flow:
 * 1. Verify admin authentication and origin
 * 2. Check if migration already done (if any UserApiKey records exist, return 409)
 * 3. Fetch all API keys from CLIProxyAPI Management API
 * 4. Find first admin user ordered by createdAt
 * 5. Create UserApiKey records for each fetched key, assigned to that admin
 * 6. Sync keys to CLIProxyAPI (should match existing, but ensures consistency)
 * 7. Return success with count
 *
 * Responses:
 * - 200: Migration successful, keys assigned
 * - 400: Invalid request (no admin user found)
 * - 401: Unauthorized (not authenticated)
 * - 403: Forbidden (user is not admin)
 * - 409: Conflict (migration already completed)
 * - 500: Server error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Verify authentication
  const session = await verifySession();
  if (!session) {
    return apiError("Unauthorized", 401);
  }

  // 2. Verify admin status
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return apiError("Forbidden - Admin access required", 403);
  }

  // 3. Validate origin
  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    // 4. Check idempotency: if any UserApiKey exists, migration is already done
    const existingKeyCount = await prisma.userApiKey.count();
    if (existingKeyCount > 0) {
      return apiError("Migration already completed", 409, `Found ${existingKeyCount} existing UserApiKey records`);
    }

    // 5. Fetch existing API keys from CLIProxyAPI
    const managementUrl =
      process.env.CLIPROXYAPI_MANAGEMENT_URL ||
      "http://cliproxyapi:8317/v0/management";
    const managementApiKey = process.env.MANAGEMENT_API_KEY;

    if (!managementApiKey) {
      logger.error("MANAGEMENT_API_KEY not set");
      return apiError("Management API not configured", 500);
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
      return apiError("Failed to fetch existing API keys from CLIProxyAPI", 500);
    }

    const data = (await response.json()) as unknown;

    // Extract api-keys array from response
    const apiKeysArray = Array.isArray((data as Record<string, unknown>)["api-keys"])
      ? ((data as Record<string, unknown>)["api-keys"] as string[])
      : [];

    // 6. Find first admin user ordered by createdAt (oldest first)
    const firstAdmin = await prisma.user.findFirst({
      where: { isAdmin: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!firstAdmin) {
      return apiError("No admin user found in database", 400);
    }

    // 7. If no keys to migrate, return success
    if (apiKeysArray.length === 0) {
      return apiSuccess({
        keysAssigned: 0,
        userId: firstAdmin.id,
      });
    }

    // 8. Create UserApiKey records in a transaction
    // Use transaction to ensure atomicity: either all keys are created or none
    await prisma.$transaction(async (tx) => {
      for (const key of apiKeysArray) {
        // Only create if key doesn't already exist (defensive check)
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

    // 9. Sync keys to CLIProxyAPI (verify consistency, should be no-op)
    const syncResult = await syncKeysToCliProxyApi();
    if (!syncResult.ok) {
      logger.warn(
        { error: syncResult.error },
        "Sync after migration failed (keys are still in DB)"
      );
      // Don't fail the migration response - keys are in DB (source of truth)
    }

    return apiSuccess({
      keysAssigned: apiKeysArray.length,
      userId: firstAdmin.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error during migration";
    logger.error({ err: error, message }, "Migration error");
    return apiError("Internal server error during migration", 500);
  }
}
