import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { apiSuccess, apiError } from "@/lib/api-response";
import { UpdateSystemSettingSchema } from "@/lib/validation/schemas";

async function requireAdmin(): Promise<{ userId: string; username: string } | NextResponse> {
  const session = await verifySession();
  if (!session) {
    return apiError("Unauthorized", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return apiError("Forbidden - Admin access required", 403);
  }

  return { userId: session.userId, username: session.username };
}

export async function GET() {
  const authResult = await requireAdmin();
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

    return apiSuccess({ settings: settingsResponse });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch system settings");
    return apiError("Internal server error", 500);
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const body = await request.json();
    const parsed = UpdateSystemSettingSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", 400, parsed.error.issues);
    }

    const { key, value } = parsed.data;

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });

    logAuditAsync({
      userId: authResult.userId,
      action: AUDIT_ACTION.SETTINGS_CHANGED,
      target: key,
      metadata: { settingId: setting.id },
      ipAddress: extractIpAddress(request),
    });

    return apiSuccess({
      setting: {
        id: setting.id,
        key: setting.key,
        value: setting.value,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to update system setting");
    return apiError("Internal server error", 500);
  }
}
