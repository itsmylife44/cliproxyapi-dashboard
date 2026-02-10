import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { getUser } from "@/lib/auth/dal";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { ERROR_CODE, Errors, apiError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimitWithPreset(request, "change-password", "CHANGE_PASSWORD");
    if (!rateLimit.allowed) {
      return Errors.rateLimited(rateLimit.retryAfterSeconds ?? 60);
    }

    const session = await verifySession();

    if (!session) {
      return Errors.unauthorized();
    }

    const originError = validateOrigin(request);
    if (originError) {
      return originError;
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return Errors.missingFields(["currentPassword", "newPassword"]);
    }

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return Errors.validation("Invalid input types");
    }

    if (
      newPassword.length < PASSWORD_MIN_LENGTH ||
      newPassword.length > PASSWORD_MAX_LENGTH
    ) {
      return apiError(
        ERROR_CODE.VALIDATION_INVALID_FORMAT,
        `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
        400
      );
    }

    const user = await getUser(session.userId);

    if (!user) {
      return apiError(ERROR_CODE.USER_NOT_FOUND, "User not found", 404);
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);

    if (!isValid) {
      return apiError(ERROR_CODE.AUTH_FAILED, "Invalid current password", 401);
    }

    if (currentPassword === newPassword) {
      return Errors.validation("New password must be different from current password");
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        sessionVersion: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return Errors.internal("Change password error", error);
  }
}
