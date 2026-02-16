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

    const keyResults = await Promise.allSettled(
      ownedKeys.map(async (key) => {
        const removeResult = await removeKey(userId, key.keyHash, isAdmin);
        if (!removeResult.ok) {
          throw new Error(`Failed to remove ${key.provider} key ${key.keyHash}: ${removeResult.error}`);
        }
        return key;
      })
    );

    for (let i = 0; i < keyResults.length; i++) {
      const settled = keyResults[i];
      if (settled.status === "fulfilled") {
        result.keysRemoved++;
      } else {
        result.keysFailedToRemove++;
        const key = ownedKeys[i];
        const errorMsg = settled.reason instanceof Error ? settled.reason.message : `Failed to remove ${key.provider} key ${key.keyHash}`;
        result.errors.push(errorMsg);
        logger.error({ provider: key.provider, keyHash: key.keyHash, error: errorMsg }, "Failed to remove provider key");
      }
    }

    const ownedOAuth = await prisma.providerOAuthOwnership.findMany({
      where: { userId },
      select: { accountName: true, provider: true },
    });

    const oauthResults = await Promise.allSettled(
      ownedOAuth.map(async (oauth) => {
        const removeResult = await removeOAuthAccount(userId, oauth.accountName, isAdmin);
        if (!removeResult.ok) {
          throw new Error(`Failed to remove ${oauth.provider} OAuth account ${oauth.accountName}: ${removeResult.error}`);
        }
        return oauth;
      })
    );

    for (let i = 0; i < oauthResults.length; i++) {
      const settled = oauthResults[i];
      if (settled.status === "fulfilled") {
        result.oauthRemoved++;
      } else {
        result.oauthFailedToRemove++;
        const oauth = ownedOAuth[i];
        const errorMsg = settled.reason instanceof Error ? settled.reason.message : `Failed to remove ${oauth.provider} OAuth account ${oauth.accountName}`;
        result.errors.push(errorMsg);
        logger.error({ provider: oauth.provider, accountName: oauth.accountName, error: errorMsg }, "Failed to remove OAuth account");
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
