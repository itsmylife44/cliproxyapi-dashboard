import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiSuccess, apiError } from "@/lib/api-response";

const WEBHOOK_HOST = process.env.WEBHOOK_HOST || "http://localhost:9000";
const DEPLOY_SECRET = process.env.DEPLOY_SECRET || "";

export async function POST(request: NextRequest) {
  const session = await verifySession();

  if (!session) {
    return apiError("Unauthorized", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return apiError("Forbidden: Admin access required", 403);
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const body = await request.json();
    const { confirm } = body;

    if (confirm !== true) {
      return apiError("Confirmation required", 400);
    }

    if (!DEPLOY_SECRET) {
      return apiError("DEPLOY_SECRET not configured. Set up the webhook deploy service first.", 500);
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
      return apiError("Failed to trigger update. Check webhook service.", 502);
    }

    await response.body?.cancel();

    return apiSuccess({
      success: true,
      message: "Dashboard update triggered. The container will restart shortly.",
    });
  } catch (error) {
    logger.error({ err: error }, "Dashboard update error");
    return apiError("Failed to reach webhook service. Is it running?", 500);
  }
}
