import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { hashPassword } from "@/lib/auth/password";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  isValidUsernameFormat,
} from "@/lib/auth/validation";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { cascadeDeleteUserProviders } from "@/lib/providers/cascade";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";
import { logger } from "@/lib/logger";

async function requireAdmin(): Promise<{ userId: string; username: string } | NextResponse> {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return Errors.forbidden();
  }

  return { userId: session.userId, username: session.username };
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          username: true,
          isAdmin: true,
          createdAt: true,
          _count: {
            select: { apiKeys: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count(),
    ]);

    const usersResponse = users.map((user) => ({
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt.toISOString(),
      apiKeyCount: user._count.apiKeys,
    }));

    return NextResponse.json({
      data: usersResponse,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + users.length < total,
      },
    });
  } catch (error) {
    return Errors.internal("Failed to fetch users", error);
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  const rateLimit = checkRateLimitWithPreset(request, "admin-users", "ADMIN_USERS");
  if (!rateLimit.allowed) {
    return Errors.rateLimited(rateLimit.retryAfterSeconds);
  }

  try {
    const body = await request.json();
    const { username, password, isAdmin } = body;

    if (!username || !password) {
      return Errors.missingFields(["username", "password"]);
    }

    if (typeof username !== "string" || typeof password !== "string") {
      return Errors.validation("Invalid input types");
    }

    if (isAdmin !== undefined && typeof isAdmin !== "boolean") {
      return Errors.validation("isAdmin must be a boolean");
    }

    if (
      username.length < USERNAME_MIN_LENGTH ||
      username.length > USERNAME_MAX_LENGTH ||
      !isValidUsernameFormat(username)
    ) {
      return Errors.validation(
        `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} chars and contain only letters, numbers, _ or -`
      );
    }

    if (
      password.length < PASSWORD_MIN_LENGTH ||
      password.length > PASSWORD_MAX_LENGTH
    ) {
      return Errors.validation(
        `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (existingUser) {
      return Errors.conflict("Username already exists");
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        isAdmin: isAdmin ?? false,
      },
    });

    logAuditAsync({
      userId: authResult.userId,
      action: AUDIT_ACTION.USER_CREATED,
      target: user.username,
      metadata: { newUserId: user.id, isAdmin: user.isAdmin },
      ipAddress: extractIpAddress(request),
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          isAdmin: user.isAdmin,
          createdAt: user.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return Errors.internal("User creation error", error);
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const { searchParams } = new URL(request.url);
    const userIdToDelete = searchParams.get("userId");

    if (!userIdToDelete || typeof userIdToDelete !== "string") {
      return Errors.validation("userId query parameter is required");
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userIdToDelete },
      select: { id: true, username: true, isAdmin: true },
    });

    if (!targetUser) {
      return Errors.notFound("User");
    }

    if (targetUser.id === authResult.userId) {
      return Errors.validation("Cannot delete your own account");
    }

    const cascadeResult = await cascadeDeleteUserProviders(userIdToDelete, true);

    await prisma.user.delete({
      where: { id: userIdToDelete },
    });

    logAuditAsync({
      userId: authResult.userId,
      action: AUDIT_ACTION.USER_DELETED,
      target: targetUser.username,
      metadata: {
        deletedUserId: userIdToDelete,
        wasAdmin: targetUser.isAdmin,
        cascade: {
          keysRemoved: cascadeResult.keysRemoved,
          oauthRemoved: cascadeResult.oauthRemoved,
        },
      },
      ipAddress: extractIpAddress(request),
    });

    logger.info(
      { admin: authResult.username, deletedUser: targetUser.username, deletedUserId: userIdToDelete, cascade: cascadeResult },
      "Admin deleted user"
    );

    return NextResponse.json({
      success: true,
      username: targetUser.username,
      cascade: {
        keysRemoved: cascadeResult.keysRemoved,
        oauthRemoved: cascadeResult.oauthRemoved,
        failedOperations:
          cascadeResult.keysFailedToRemove + cascadeResult.oauthFailedToRemove,
        errors: cascadeResult.errors,
      },
    });
  } catch (error) {
    return Errors.internal("User deletion error", error);
  }
}
