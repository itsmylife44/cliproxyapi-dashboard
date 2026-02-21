import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { Errors } from "@/lib/errors";
import { prisma } from "@/lib/db";

const REQUIRED_COOKIE_KEYS = ["next-auth.session-token"];

function isValidCookieJson(raw: string): { valid: boolean; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, error: "Invalid JSON" };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { valid: false, error: "Must be a JSON object" };
  }

  const obj = parsed as Record<string, unknown>;
  const missing = REQUIRED_COOKIE_KEYS.filter(
    (key) => typeof obj[key] !== "string" || !(obj[key] as string).trim()
  );

  if (missing.length > 0) {
    return { valid: false, error: `Missing required keys: ${missing.join(", ")}` };
  }

  return { valid: true };
}

export async function GET() {
  const session = await verifySession();
  if (!session) return Errors.unauthorized();

  try {
    const cookies = await prisma.perplexityCookie.findMany({
      where: { userId: session.userId },
      select: {
        id: true,
        label: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ cookies });
  } catch (error) {
    return Errors.internal("fetch perplexity cookies", error);
  }
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) return Errors.unauthorized();

  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Errors.validation("Invalid request body");
    }

    const { cookieData, label } = body as Record<string, unknown>;

    if (typeof cookieData !== "string" || !cookieData.trim()) {
      return Errors.missingFields(["cookieData"]);
    }

    const cookieValidation = isValidCookieJson(cookieData);
    if (!cookieValidation.valid) {
      return Errors.validation(`Invalid cookie data: ${cookieValidation.error}`);
    }

    await prisma.perplexityCookie.updateMany({
      where: { userId: session.userId, isActive: true },
      data: { isActive: false },
    });

    const cookie = await prisma.perplexityCookie.create({
      data: {
        userId: session.userId,
        cookieData: cookieData.trim(),
        label: typeof label === "string" && label.trim() ? label.trim() : "Default",
        isActive: true,
      },
      select: {
        id: true,
        label: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ cookie }, { status: 201 });
  } catch (error) {
    return Errors.internal("save perplexity cookie", error);
  }
}

export async function DELETE(request: NextRequest) {
  const session = await verifySession();
  if (!session) return Errors.unauthorized();

  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Errors.validation("Invalid request body");
    }

    const { id } = body as Record<string, unknown>;

    if (typeof id !== "string") {
      return Errors.missingFields(["id"]);
    }

    const existing = await prisma.perplexityCookie.findFirst({
      where: { id, userId: session.userId },
    });

    if (!existing) {
      return Errors.notFound("Perplexity cookie");
    }

    await prisma.perplexityCookie.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return Errors.internal("delete perplexity cookie", error);
  }
}
