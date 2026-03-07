import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { ModelPreferencesSchema } from "@/lib/validation/schemas";
import { Errors, apiSuccess } from "@/lib/errors";

export async function GET() {
  try {
    const session = await verifySession();

    if (!session) {
      return Errors.unauthorized();
    }

    const modelPreference = await prisma.modelPreference.findUnique({
      where: { userId: session.userId },
    });

    if (!modelPreference) {
      return NextResponse.json({ excludedModels: [] });
    }

    return NextResponse.json({ excludedModels: modelPreference.excludedModels });
  } catch (error) {
    return Errors.internal("Get model preferences error", error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await verifySession();

    if (!session) {
      return Errors.unauthorized();
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
      return Errors.notFound("User");
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
      return Errors.zodValidation(error.issues);
    }
    return Errors.internal("Update model preferences error", error);
  }
}
