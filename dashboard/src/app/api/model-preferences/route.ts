import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { ModelPreferencesSchema, formatZodError } from "@/lib/validation/schemas";

export async function GET() {
  try {
    const session = await verifySession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const modelPreference = await prisma.modelPreference.findUnique({
      where: { userId: session.userId },
    });

    if (!modelPreference) {
      return NextResponse.json({ excludedModels: [] });
    }

    return NextResponse.json({ excludedModels: modelPreference.excludedModels });
  } catch (error) {
    logger.error({ err: error }, "Get model preferences error:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await verifySession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const originError = validateOrigin(request);
    if (originError) {
      return originError;
    }

    const body = await request.json();
    const validated = ModelPreferencesSchema.parse(body);

    const userExists = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true },
    });
    
    if (!userExists) {
      return NextResponse.json({ error: "User not found - please log in again" }, { status: 401 });
    }

    const modelPreference = await prisma.modelPreference.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        excludedModels: validated.excludedModels,
      },
      update: {
        excludedModels: validated.excludedModels,
      },
    });

    return NextResponse.json({
      success: true,
      excludedModels: modelPreference.excludedModels,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatZodError(error), { status: 400 });
    }
    logger.error({ err: error }, "Update model preferences error:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
