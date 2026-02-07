import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";

async function requireAdmin(
  _request: NextRequest
): Promise<{ userId: string; username: string } | NextResponse> {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return NextResponse.json(
      { error: "Forbidden - Admin access required" },
      { status: 403 }
    );
  }

  return { userId: session.userId, username: session.username };
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const settings = await prisma.systemSetting.findMany();

    const settingsResponse = settings.map((setting) => ({
      id: setting.id,
      key: setting.key,
      value: setting.value,
    }));

    return NextResponse.json({ settings: settingsResponse });
  } catch (error) {
    console.error("Failed to fetch system settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || !value) {
      return NextResponse.json(
        { error: "Key and value are required" },
        { status: 400 }
      );
    }

    if (typeof key !== "string" || typeof value !== "string") {
      return NextResponse.json(
        { error: "Key and value must be strings" },
        { status: 400 }
      );
    }

    if (key.length === 0 || key.length > 255) {
      return NextResponse.json(
        { error: "Key must be between 1 and 255 characters" },
        { status: 400 }
      );
    }

    if (value.length === 0 || value.length > 1000) {
      return NextResponse.json(
        { error: "Value must be between 1 and 1000 characters" },
        { status: 400 }
      );
    }

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });

    return NextResponse.json(
      {
        success: true,
        setting: {
          id: setting.id,
          key: setting.key,
          value: setting.value,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to update system setting:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
