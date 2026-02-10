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

    for (const key of ownedKeys) {
      try {
        const removeResult = await removeKey(userId, key.keyHash, isAdmin);
        if (removeResult.ok) {
          result.keysRemoved++;
        } else {
          result.keysFailedToRemove++;
          const errorMsg = `Failed to remove ${key.provider} key ${key.keyHash}: ${removeResult.error}`;
          result.errors.push(errorMsg);
          logger.error({ provider: key.provider, keyHash: key.keyHash, error: removeResult.error }, "Failed to remove provider key");
        }
      } catch (error) {
        result.keysFailedToRemove++;
        const errorMsg = `Exception removing ${key.provider} key ${key.keyHash}: ${error instanceof Error ? error.message : "Unknown error"}`;
        result.errors.push(errorMsg);
        logger.error({ err: error, provider: key.provider, keyHash: key.keyHash }, "Exception removing provider key");
      }
    }

    const ownedOAuth = await prisma.providerOAuthOwnership.findMany({
      where: { userId },
      select: { accountName: true, provider: true },
    });

    for (const oauth of ownedOAuth) {
      try {
        const removeResult = await removeOAuthAccount(userId, oauth.accountName, isAdmin);
        if (removeResult.ok) {
          result.oauthRemoved++;
        } else {
          result.oauthFailedToRemove++;
          const errorMsg = `Failed to remove ${oauth.provider} OAuth account ${oauth.accountName}: ${removeResult.error}`;
          result.errors.push(errorMsg);
          logger.error({ provider: oauth.provider, accountName: oauth.accountName, error: removeResult.error }, "Failed to remove OAuth account");
        }
      } catch (error) {
        result.oauthFailedToRemove++;
        const errorMsg = `Exception removing ${oauth.provider} OAuth account ${oauth.accountName}: ${error instanceof Error ? error.message : "Unknown error"}`;
        result.errors.push(errorMsg);
        logger.error({ err: error, provider: oauth.provider, accountName: oauth.accountName }, "Exception removing OAuth account");
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
