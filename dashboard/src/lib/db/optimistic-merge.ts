import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

/**
 * Atomically merge overrides with optimistic concurrency control.
 * Uses a read-modify-write pattern with version checking via updatedAt.
 *
 * @param userId - User ID
 * @param updates - New override values to merge (shallow merge at top level)
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @returns Object with success status and merged overrides on success
 * @throws Never - returns success: false after maxRetries exhausted
 */
export async function atomicMergeOverrides(
  userId: string,
  updates: Record<string, unknown>,
  maxRetries = 3
): Promise<
  | { success: true; overrides: Record<string, unknown> }
  | { success: false; reason: "conflict" | "error" }
> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // 1. Read current state with updatedAt for version check
      const existing = await prisma.agentModelOverride.findUnique({
        where: { userId },
        select: { overrides: true, updatedAt: true },
      });

      // 2. Merge in memory (shallow merge - top-level key replacement)
      const existingOverrides = (existing?.overrides as Record<string, unknown>) ?? {};
      const mergedOverrides = { ...existingOverrides, ...updates };
      const serializedOverrides = JSON.parse(JSON.stringify(mergedOverrides));

      if (!existing) {
        // 3a. No existing record - try to create
        try {
          const created = await prisma.agentModelOverride.create({
            data: {
              userId,
              overrides: serializedOverrides,
            },
          });
          return {
            success: true,
            overrides: created.overrides as Record<string, unknown>,
          };
        } catch (err) {
          // P2002 = unique constraint violation (record was created between read and create)
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002"
          ) {
            // Retry - record now exists
            continue;
          }
          throw err;
        }
      }

      // 3b. Existing record - conditional update with version check
      const result = await prisma.agentModelOverride.updateMany({
        where: {
          userId,
          updatedAt: existing.updatedAt,
        },
        data: {
          overrides: serializedOverrides,
        },
      });

      // 4. Check if update succeeded (count === 0 means row was modified by another request)
      if (result.count === 0) {
        // Conflict detected - retry
        continue;
      }

      return {
        success: true,
        overrides: mergedOverrides,
      };
    } catch (err) {
      // Handle P2002 on creation race condition
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // Retry as update
        continue;
      }
      // Unexpected error - don't retry
      throw err;
    }
  }

  // All retries exhausted
  return { success: false, reason: "conflict" };
}
