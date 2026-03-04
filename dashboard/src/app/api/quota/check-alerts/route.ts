import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { runAlertCheck } from "@/lib/quota-alerts";

const MANAGEMENT_API_KEY = process.env.MANAGEMENT_API_KEY;

async function requireAdmin(): Promise<
  { userId: string; username: string } | NextResponse
> {
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

  return { userId: session.userId, username: session.username };
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    // Use server-side env var for base URL instead of trusting request headers
    const port = process.env.PORT ?? "3000";
    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.DASHBOARD_URL ?? `http://localhost:${port}`;

    if (!MANAGEMENT_API_KEY) {
      return Errors.internal("check quota alerts", new Error("MANAGEMENT_API_KEY not configured"));
    }

    const quotaFetcher = async () => {
      try {
        const quotaResponse = await fetch(`${baseUrl}/api/quota`, {
          headers: { "X-Internal-Key": MANAGEMENT_API_KEY },
          signal: AbortSignal.timeout(60_000),
        });
        if (!quotaResponse.ok) return null;
        return await quotaResponse.json();
      } catch {
        return null;
      }
    };

    const result = await runAlertCheck(quotaFetcher, baseUrl);
    return NextResponse.json(result);
  } catch (error) {
    return Errors.internal("check quota alerts", error);
  }
}
