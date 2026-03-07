import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { contributeOAuthAccount, listOAuthWithOwnership } from "@/lib/providers/dual-write";
import { OAUTH_PROVIDER, type OAuthProvider } from "@/lib/providers/constants";
import { ERROR_CODE, Errors, apiError } from "@/lib/errors";
import { prisma } from "@/lib/db";

interface ContributeOAuthRequest {
  provider: string;
  accountName: string;
  accountEmail?: string;
}

function isContributeOAuthRequest(body: unknown): body is ContributeOAuthRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;

  const obj = body as Record<string, unknown>;

  if (typeof obj.provider !== "string") return false;
  if (typeof obj.accountName !== "string") return false;
  if (obj.accountEmail !== undefined && typeof obj.accountEmail !== "string") return false;

  return true;
}

function isValidOAuthProvider(provider: string): provider is OAuthProvider {
  return Object.values(OAUTH_PROVIDER).includes(provider as OAuthProvider);
}

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    const isAdmin = user?.isAdmin ?? false;

    const result = await listOAuthWithOwnership(session.userId, isAdmin);

    if (!result.ok) {
      return apiError(ERROR_CODE.PROVIDER_ERROR, result.error ?? "Provider error", 500);
    }

    return NextResponse.json({ accounts: result.accounts });
  } catch (error) {
    return Errors.internal("GET /api/providers/oauth error", error);
  }
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

  try {
    const body = await request.json();

    if (!isContributeOAuthRequest(body)) {
      return Errors.validation("Invalid request body");
    }

    if (!isValidOAuthProvider(body.provider)) {
      return apiError(ERROR_CODE.PROVIDER_INVALID, "Invalid OAuth provider", 400);
    }

    const result = await contributeOAuthAccount(
      session.userId,
      body.provider,
      body.accountName,
      body.accountEmail
    );

    if (!result.ok) {
      if (result.error?.includes("already registered")) {
        return Errors.conflict(result.error);
      }
      return apiError(ERROR_CODE.PROVIDER_ERROR, result.error ?? "Provider error", 500);
    }

    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (error) {
    return Errors.internal("POST /api/providers/oauth error", error);
  }
}
