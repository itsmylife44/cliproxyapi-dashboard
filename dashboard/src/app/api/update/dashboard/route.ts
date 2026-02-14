import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const WEBHOOK_HOST = process.env.WEBHOOK_HOST || "http://localhost:9000";
const DEPLOY_SECRET = process.env.DEPLOY_SECRET || "";

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

    if (!DEPLOY_SECRET) {
      return NextResponse.json(
        { error: "DEPLOY_SECRET not configured. Set up the webhook deploy service first." },
        { status: 500 }
      );
    }

    const response = await fetch(`${WEBHOOK_HOST}/hooks/deploy-dashboard`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Deploy-Token": DEPLOY_SECRET,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, body: text }, "Webhook trigger failed");
      return NextResponse.json(
        { error: "Failed to trigger update. Check webhook service." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Dashboard update triggered. The container will restart shortly.",
    });
  } catch (error) {
    logger.error({ err: error }, "Dashboard update error");
    return NextResponse.json(
      { error: "Failed to reach webhook service. Is it running?" },
      { status: 500 }
    );
  }
}
