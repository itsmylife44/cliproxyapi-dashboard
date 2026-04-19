import "server-only";
import { prisma } from "@/lib/db";
import { removeKey, removeOAuthAccount } from "./dual-write";
import { logger } from "@/lib/logger";

interface CascadeResult {
  keysRemoved: number;
  keysFailedToRemove: number;
  oauthRemoved: number;
  oauthFailedToRemove: number;
  errors: string[];
}

/**
 * Remove all provider keys and OAuth accounts owned by a user from Management API
 * Soft-fail strategy: log errors but continue deletion
 * 
 * @param userId - User ID to cascade delete for
 * @param isAdmin - Whether the requesting user is an admin (required for cleanup)
 * @returns CascadeResult with success/failure counts and error messages
 */
export async function cascadeDeleteUserProviders(
  userId: string,
  isAdmin: boolean
): Promise<CascadeResult> {
  const result: CascadeResult = {
    keysRemoved: 0,
    keysFailedToRemove: 0,
    oauthRemoved: 0,
    oauthFailedToRemove: 0,
    errors: [],
  };

  try {
    const ownedKeys = await prisma.providerKeyOwnership.findMany({
      where: { userId },
      select: { keyHash: true, provider: true },
    });

    const keyResults = await Promise.all(
      ownedKeys.map(async (key) => {
        try {
          const removeResult = await removeKey(userId, key.keyHash, isAdmin);
          if (!removeResult.ok) {
            return {
              ok: false as const,
              error: `Failed to remove ${key.provider} key ${key.keyHash}: ${removeResult.error}`,
              key,
            };
          }

          return { ok: true as const, key };
        } catch (error) {
          return {
            ok: false as const,
            error: error instanceof Error ? error.message : `Failed to remove ${key.provider} key ${key.keyHash}`,
            key,
          };
        }
      })
    );

    for (const keyResult of keyResults) {
      if (keyResult.ok) {
        result.keysRemoved++;
      } else {
        result.keysFailedToRemove++;
        result.errors.push(keyResult.error);
        logger.error({ provider: keyResult.key.provider, keyHash: keyResult.key.keyHash, error: keyResult.error }, "Failed to remove provider key");
      }
    }

    const ownedOAuth = await prisma.providerOAuthOwnership.findMany({
      where: { userId },
      select: { accountName: true, provider: true },
    });

    const oauthResults = await Promise.all(
      ownedOAuth.map(async (oauth) => {
        try {
          const removeResult = await removeOAuthAccount(userId, oauth.accountName, isAdmin);
          if (!removeResult.ok) {
            return {
              ok: false as const,
              error: `Failed to remove ${oauth.provider} OAuth account ${oauth.accountName}: ${removeResult.error}`,
              oauth,
            };
          }

          return { ok: true as const, oauth };
        } catch (error) {
          return {
            ok: false as const,
            error: error instanceof Error ? error.message : `Failed to remove ${oauth.provider} OAuth account ${oauth.accountName}`,
            oauth,
          };
        }
      })
    );

    for (const oauthResult of oauthResults) {
      if (oauthResult.ok) {
        result.oauthRemoved++;
      } else {
        result.oauthFailedToRemove++;
        result.errors.push(oauthResult.error);
        logger.error({ provider: oauthResult.oauth.provider, accountName: oauthResult.oauth.accountName, error: oauthResult.error }, "Failed to remove OAuth account");
      }
    }

    logger.info(
      { userId, keysRemoved: result.keysRemoved, keysFailedToRemove: result.keysFailedToRemove, oauthRemoved: result.oauthRemoved, oauthFailedToRemove: result.oauthFailedToRemove },
      "User cascade deletion completed"
    );
  } catch (error) {
    const errorMsg = `Fatal error during cascade deletion for user ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`;
    result.errors.push(errorMsg);
    logger.error({ err: error, userId }, "Fatal error during cascade deletion");
  }

  return result;
}
