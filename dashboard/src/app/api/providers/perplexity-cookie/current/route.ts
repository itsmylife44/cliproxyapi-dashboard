import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { env } from "@/lib/env";
import { apiSuccess } from "@/lib/api-response";

const HMAC_KEY = Buffer.alloc(32);

function safeTokenCompare(a: string, b: string): boolean {
  const ha = createHmac("sha256", HMAC_KEY).update(a).digest();
  const hb = createHmac("sha256", HMAC_KEY).update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return Errors.unauthorized();
  }

  const validTokens = [env.MANAGEMENT_API_KEY];
  if (env.PERPLEXITY_SIDECAR_SECRET) {
    validTokens.push(env.PERPLEXITY_SIDECAR_SECRET);
  }

  const isValid = validTokens.some((valid) => safeTokenCompare(token, valid));
  if (!isValid) {
    return Errors.unauthorized();
  }

  try {
    const activeCookie = await prisma.perplexityCookie.findFirst({
      where: { isActive: true },
      select: { id: true, cookieData: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!activeCookie) {
      return apiSuccess({ cookies: null });
    }

    await prisma.perplexityCookie.update({
      where: { id: activeCookie.id },
      data: { lastUsedAt: new Date() },
    });

    return apiSuccess({
      cookies: JSON.parse(activeCookie.cookieData),
      updatedAt: activeCookie.updatedAt.toISOString(),
    });
  } catch (error) {
    return Errors.internal("fetch active perplexity cookie", error);
  }
}
