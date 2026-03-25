import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { Errors } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import {
  fetchWithTimeout,
  MANAGEMENT_BASE_URL,
  MANAGEMENT_API_KEY,
  isRecord,
} from "@/lib/providers/management-api";

interface ClaimRequest {
  accountName: string;
}

function isClaimRequest(body: unknown): body is ClaimRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const obj = body as Record<string, unknown>;
  return typeof obj.accountName === "string" && obj.accountName.trim().length > 0;
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  const rateLimit = checkRateLimitWithPreset(request, "oauth-accounts", "OAUTH_ACCOUNTS");
  if (!rateLimit.allowed) {
    return Errors.rateLimited(rateLimit.retryAfterSeconds);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Errors.validation("Invalid JSON");
  }

  if (!isClaimRequest(body)) {
    return Errors.validation("Request body must include 'accountName' (string)");
  }

  const { accountName } = body;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    const isAdmin = user?.isAdmin ?? false;
    if (!isAdmin) {
      return Errors.forbidden();
    }

    if (!MANAGEMENT_API_KEY) {
      return Errors.internal("Management API key not configured");
    }

    const existing = await prisma.providerOAuthOwnership.findUnique({
      where: { accountName },
    });

    if (existing) {
      return Errors.conflict("Account already has an owner");
    }

    let getRes: Response;
    try {
      getRes = await fetchWithTimeout(`${MANAGEMENT_BASE_URL}/auth-files`, {
        method: "GET",
        headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
      });
    } catch {
      return Errors.badGateway("Failed to reach management API");
    }

    if (!getRes.ok) {
      await getRes.body?.cancel();
      return Errors.badGateway("Failed to fetch auth files");
    }

    const getData = await getRes.json();
    if (!isRecord(getData) || !Array.isArray(getData.files)) {
      return Errors.badGateway("Invalid management API response");
    }

    const authFiles = getData.files as Array<{
      name: string;
      provider?: string;
      type?: string;
      email?: string;
    }>;

    const matchingFile = authFiles.find((f) => f.name === accountName);
    if (!matchingFile) {
      return Errors.notFound("Auth file not found in CLIProxyAPIPlus");
    }

    const provider = matchingFile.provider || matchingFile.type || "unknown";

    try {
      const ownership = await prisma.providerOAuthOwnership.create({
        data: {
          userId: session.userId,
          provider,
          accountName,
          accountEmail: matchingFile.email || null,
        },
      });

      logger.info(
        { accountName, provider, userId: session.userId },
        "Admin claimed ownership of unclaimed OAuth account"
      );

      return NextResponse.json({ id: ownership.id, accountName, provider }, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return Errors.conflict("Account was claimed by another user");
      }
      throw e;
    }
  } catch (error) {
    return Errors.internal("Failed to claim OAuth account", error);
  }
}
