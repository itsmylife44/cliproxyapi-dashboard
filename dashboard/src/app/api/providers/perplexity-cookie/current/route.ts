import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { env } from "@/lib/env";

const SIDECAR_SECRET = "perplexity-sidecar-internal";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  const isInternalCall = token === env.MANAGEMENT_API_KEY || token === SIDECAR_SECRET;
  if (!isInternalCall) {
    return Errors.unauthorized();
  }

  try {
    const activeCookie = await prisma.perplexityCookie.findFirst({
      where: { isActive: true },
      select: { id: true, cookieData: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!activeCookie) {
      return NextResponse.json({ cookies: null });
    }

    await prisma.perplexityCookie.update({
      where: { id: activeCookie.id },
      data: { lastUsedAt: new Date() },
    });

    return NextResponse.json({
      cookies: JSON.parse(activeCookie.cookieData),
      updatedAt: activeCookie.updatedAt.toISOString(),
    });
  } catch (error) {
    return Errors.internal("fetch active perplexity cookie", error);
  }
}
