import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";

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
    console.error("Get model preferences error:", error);
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

    if (!Array.isArray(body.excludedModels)) {
      return NextResponse.json(
        { error: "excludedModels must be an array" },
        { status: 400 }
      );
    }

    if (body.excludedModels.length > 500) {
      return NextResponse.json(
        { error: "excludedModels array cannot exceed 500 items" },
        { status: 400 }
      );
    }

    for (const model of body.excludedModels) {
      if (typeof model !== "string" || model.length === 0 || model.length > 200) {
        return NextResponse.json(
          { error: "Each model must be a non-empty string with max 200 characters" },
          { status: 400 }
        );
      }
    }

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
        excludedModels: body.excludedModels,
      },
      update: {
        excludedModels: body.excludedModels,
      },
    });

    return NextResponse.json({
      success: true,
      excludedModels: modelPreference.excludedModels,
    });
  } catch (error) {
    console.error("Update model preferences error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
