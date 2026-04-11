import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";

export async function GET() {
  try {
    // DEV BYPASS: skip auth when SKIP_AUTH=1
    if (process.env.SKIP_AUTH === "1") {
      return NextResponse.json({
        id: "dev-user-id",
        username: "dev",
        isAdmin: true,
        createdAt: new Date().toISOString(),
      });
    }

    const session = await verifySession();

    if (!session) {
      return Errors.unauthorized();
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    if (!user) {
      return Errors.notFound("User");
    }

    return NextResponse.json({
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (error) {
    return Errors.internal("Failed to fetch current user", error);
  }
}
