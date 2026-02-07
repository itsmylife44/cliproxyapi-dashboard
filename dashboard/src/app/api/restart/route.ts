import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const CONTAINER_NAME = "cliproxyapi";

export async function POST(request: NextRequest) {
  const session = await verifySession();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return NextResponse.json(
      { error: "Forbidden: Admin access required" },
      { status: 403 }
    );
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const body = await request.json();
    const { confirm } = body;

    if (confirm !== true) {
      return NextResponse.json(
        { error: "Confirmation required" },
        { status: 400 }
      );
    }

    await execFileAsync("docker", ["restart", CONTAINER_NAME]);

    return NextResponse.json({
      success: true,
      message: "Restart completed",
    });
  } catch (error) {
    console.error("Restart endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
