import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { hashPassword } from "@/lib/auth/password";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  isValidUsernameFormat,
} from "@/lib/auth/validation";
import { prisma } from "@/lib/db";
import { cascadeDeleteUserProviders } from "@/lib/providers/cascade";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";

async function requireAdmin(): Promise<{ userId: string; username: string } | NextResponse> {
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
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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

  try {
    const body = await request.json();
    const { username, password, isAdmin } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Invalid input types" },
        { status: 400 }
      );
    }

    if (isAdmin !== undefined && typeof isAdmin !== "boolean") {
      return NextResponse.json(
        { error: "isAdmin must be a boolean" },
        { status: 400 }
      );
    }

    if (
      username.length < USERNAME_MIN_LENGTH ||
      username.length > USERNAME_MAX_LENGTH ||
      !isValidUsernameFormat(username)
    ) {
      return NextResponse.json(
        {
          error: `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} chars and contain only letters, numbers, _ or -`,
        },
        { status: 400 }
      );
    }

    if (
      password.length < PASSWORD_MIN_LENGTH ||
      password.length > PASSWORD_MAX_LENGTH
    ) {
      return NextResponse.json(
        {
          error: `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
        },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 400 }
      );
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
    console.error("User creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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
      return NextResponse.json(
        { error: "userId query parameter is required" },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userIdToDelete },
      select: { id: true, username: true, isAdmin: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.id === authResult.userId) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
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

    console.log(
      `Admin ${authResult.username} deleted user ${targetUser.username} (${userIdToDelete}). Cascade: ${cascadeResult.keysRemoved} keys, ${cascadeResult.oauthRemoved} OAuth removed; ${cascadeResult.keysFailedToRemove} keys failed, ${cascadeResult.oauthFailedToRemove} OAuth failed`
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
    console.error("User deletion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
