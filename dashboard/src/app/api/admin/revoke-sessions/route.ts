import { NextRequest, NextResponse } from "next/server";
import { verifySession, createSession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { signToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, isAdmin: true },
  });

  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const others = await tx.user.updateMany({
        where: {
          id: {
            not: user.id,
          },
        },
        data: {
          sessionVersion: {
            increment: 1,
          },
        },
      });

      const currentUser = await tx.user.update({
        where: { id: user.id },
        data: {
          sessionVersion: {
            increment: 1,
          },
        },
        select: {
          id: true,
          username: true,
          sessionVersion: true,
        },
      });

      return {
        revokedUsers: others.count,
        currentUser,
      };
    });

    const token = await signToken({
      userId: result.currentUser.id,
      username: result.currentUser.username,
      sessionVersion: result.currentUser.sessionVersion,
    });

    await createSession(
      {
        userId: result.currentUser.id,
        username: result.currentUser.username,
        sessionVersion: result.currentUser.sessionVersion,
      },
      token
    );

    logAuditAsync({
      userId: user.id,
      action: AUDIT_ACTION.SETTINGS_CHANGED,
      target: "sessions:revoke-all",
      metadata: {
        revokedUsers: result.revokedUsers,
      },
      ipAddress: extractIpAddress(request),
    });

    return NextResponse.json({
      success: true,
      revokedUsers: result.revokedUsers,
      message: `Revoked sessions for ${result.revokedUsers} user(s).`,
    });
  } catch (error) {
    logger.error({ err: error, userId: user.id }, "Failed to revoke all sessions");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
