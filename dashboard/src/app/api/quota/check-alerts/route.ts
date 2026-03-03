import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { runAlertCheck } from "@/lib/quota-alerts";
import { cookies } from "next/headers";

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
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");

    const protocol = request.headers.get("x-forwarded-proto") ?? "http";
    const host =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      "localhost:3000";
    const baseUrl = `${protocol}://${host}`;

    const quotaFetcher = async () => {
      const quotaResponse = await fetch(`${baseUrl}/api/quota`, {
        headers: {
          Cookie: sessionCookie ? `session=${sessionCookie.value}` : "",
        },
      });
      if (!quotaResponse.ok) return null;
      return quotaResponse.json();
    };

    const result = await runAlertCheck(quotaFetcher, baseUrl);
    return NextResponse.json(result);
  } catch (error) {
    return Errors.internal("check quota alerts", error);
  }
}
