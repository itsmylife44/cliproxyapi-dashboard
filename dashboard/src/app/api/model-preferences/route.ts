import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { ModelPreferencesSchema, formatZodError } from "@/lib/validation/schemas";
import { logger } from "@/lib/logger";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await verifySession();

    if (!session) {
      return apiError("Unauthorized", 401);
    }

    const modelPreference = await prisma.modelPreference.findUnique({
      where: { userId: session.userId },
    });

    if (!modelPreference) {
      return apiSuccess({ excludedModels: [] });
    }

    return apiSuccess({ excludedModels: modelPreference.excludedModels });
  } catch (error) {
    logger.error({ err: error }, "Get model preferences error");
    return apiError("Internal server error", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await verifySession();

    if (!session) {
      return apiError("Unauthorized", 401);
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
      return apiError("User not found - please log in again", 401);
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

    return apiSuccess({
      excludedModels: modelPreference.excludedModels,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError("Validation failed", 400, formatZodError(error));
    }
    logger.error({ err: error }, "Update model preferences error");
    return apiError("Internal server error", 500);
  }
}
