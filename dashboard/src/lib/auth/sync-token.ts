import crypto from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

interface TokenResult {
  token: string;
  hash: string;
}

export function generateSyncToken(): TokenResult {
  const tokenBuffer = crypto.randomBytes(32);
  const token = tokenBuffer.toString("base64url");

  const hash = crypto.createHash("sha256").update(token).digest("hex");

  return { token, hash };
}

export function verifySyncToken(token: string, hash: string): boolean {
  const computedHash = crypto.createHash("sha256").update(token).digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash),
      Buffer.from(hash)
    );
  } catch {
    return false;
  }
}

export async function validateSyncTokenFromHeader(
  request: NextRequest
): Promise<{ userId: string; syncApiKey: string | null } | null> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  try {
    const syncToken = await prisma.syncToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
      },
      select: {
        id: true,
        userId: true,
        syncApiKey: true,
      },
    });

    if (!syncToken) {
      return null;
    }

    await prisma.syncToken.update({
      where: { id: syncToken.id },
      data: { lastUsedAt: new Date() },
    });

    return { userId: syncToken.userId, syncApiKey: syncToken.syncApiKey };
  } catch {
    return null;
  }
}
