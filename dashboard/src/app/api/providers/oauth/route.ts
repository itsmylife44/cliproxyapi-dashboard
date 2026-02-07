import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { contributeOAuthAccount, listOAuthWithOwnership } from "@/lib/providers/dual-write";
import { OAUTH_PROVIDER, type OAuthProvider } from "@/lib/providers/constants";
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

export async function GET(_request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    const isAdmin = user?.isAdmin ?? false;

    const result = await listOAuthWithOwnership(session.userId, isAdmin);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ accounts: result.accounts });
  } catch (error) {
    console.error("GET /api/providers/oauth error:", error);
    return NextResponse.json(
      { error: "Failed to fetch OAuth accounts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const body = await request.json();

    if (!isContributeOAuthRequest(body)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (!isValidOAuthProvider(body.provider)) {
      return NextResponse.json(
        { error: "Invalid OAuth provider" },
        { status: 400 }
      );
    }

    const result = await contributeOAuthAccount(
      session.userId,
      body.provider,
      body.accountName,
      body.accountEmail
    );

    if (!result.ok) {
      if (result.error?.includes("already registered")) {
        return NextResponse.json({ error: result.error }, { status: 409 });
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/providers/oauth error:", error);
    return NextResponse.json(
      { error: "Failed to register OAuth account" },
      { status: 500 }
    );
  }
}
