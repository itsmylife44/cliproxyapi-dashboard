import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { normalizeShareCode } from "@/lib/share-code";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

interface SubscriptionResponse {
  templateName: string;
  publisherUsername: string;
  publisherId: string;
  isActive: boolean;
  subscribedAt: string;
  lastSyncedAt: string | null;
}

interface SubscribeRequest {
  shareCode?: string;
}

interface UpdateSubscriptionRequest {
  isActive?: boolean;
}

function isSubscribeRequest(body: unknown): body is SubscribeRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  
  const obj = body as Record<string, unknown>;
  
  if (obj.shareCode === undefined || typeof obj.shareCode !== "string") return false;
  
  return true;
}

function isUpdateSubscriptionRequest(body: unknown): body is UpdateSubscriptionRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  
  const obj = body as Record<string, unknown>;
  
  if (obj.isActive !== undefined && typeof obj.isActive !== "boolean") return false;
  
  return obj.isActive !== undefined;
}

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const subscription = await prisma.configSubscription.findUnique({
      where: { userId: session.userId },
      include: {
        template: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(null);
    }

    const response: SubscriptionResponse = {
      templateName: subscription.template.name,
      publisherUsername: subscription.template.user.username,
      publisherId: subscription.template.user.id,
      isActive: subscription.isActive,
      subscribedAt: subscription.subscribedAt.toISOString(),
      lastSyncedAt: subscription.lastSyncedAt?.toISOString() || null,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch subscription");
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const body = await request.json();
    
    if (!isSubscribeRequest(body)) {
      return NextResponse.json(
        { error: "Invalid request body: shareCode is required" },
        { status: 400 }
      );
    }

    if (!body.shareCode) {
      return NextResponse.json(
        { error: "shareCode is required" },
        { status: 400 }
      );
    }

    const normalizedCode = normalizeShareCode(body.shareCode);

    const template = await prisma.configTemplate.findUnique({
      where: { shareCode: normalizedCode },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found with provided share code" },
        { status: 404 }
      );
    }

    if (!template.isActive) {
      return NextResponse.json(
        { error: "Template is not active" },
        { status: 400 }
      );
    }

    if (template.userId === session.userId) {
      return NextResponse.json(
        { error: "Cannot subscribe to your own template" },
        { status: 403 }
      );
    }

    const userApiKeys = await prisma.userApiKey.findMany({
      where: { userId: session.userId },
      select: { id: true },
      take: 1,
    });

    if (userApiKeys.length === 0) {
      return NextResponse.json(
        { error: "Cannot subscribe without at least one API key. Please add an API key first." },
        { status: 400 }
      );
    }

    const modelPref = await prisma.modelPreference.findUnique({
      where: { userId: session.userId },
    });
    const agentOverride = await prisma.agentModelOverride.findUnique({
      where: { userId: session.userId },
    });
    
    const previousConfig = {
      modelPreference: modelPref ? {
        excludedModels: modelPref.excludedModels,
      } : null,
      agentModelOverride: agentOverride ? {
        overrides: agentOverride.overrides,
      } : null,
    };

    const subscription = await prisma.configSubscription.upsert({
      where: { userId: session.userId },
      update: {
        templateId: template.id,
        isActive: true,
        previousConfig: previousConfig,
      },
      create: {
        userId: session.userId,
        templateId: template.id,
        isActive: true,
        previousConfig: previousConfig,
      },
      include: {
        template: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    const response: SubscriptionResponse = {
      templateName: subscription.template.name,
      publisherUsername: subscription.template.user.username,
      publisherId: subscription.template.user.id,
      isActive: subscription.isActive,
      subscribedAt: subscription.subscribedAt.toISOString(),
      lastSyncedAt: subscription.lastSyncedAt?.toISOString() || null,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "Failed to create subscription");
    return NextResponse.json(
      { error: "Failed to create subscription" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const body = await request.json();
    
    if (!isUpdateSubscriptionRequest(body)) {
      return NextResponse.json(
        { error: "Invalid request body: isActive is required" },
        { status: 400 }
      );
    }

    const existingSubscription = await prisma.configSubscription.findUnique({
      where: { userId: session.userId },
    });

    if (!existingSubscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    const subscription = await prisma.configSubscription.update({
      where: { userId: session.userId },
      data: {
        isActive: body.isActive,
      },
      include: {
        template: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    const response: SubscriptionResponse = {
      templateName: subscription.template.name,
      publisherUsername: subscription.template.user.username,
      publisherId: subscription.template.user.id,
      isActive: subscription.isActive,
      subscribedAt: subscription.subscribedAt.toISOString(),
      lastSyncedAt: subscription.lastSyncedAt?.toISOString() || null,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error({ err: error }, "Failed to update subscription");
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const existingSubscription = await prisma.configSubscription.findUnique({
      where: { userId: session.userId },
    });

    if (!existingSubscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    await prisma.configSubscription.delete({
      where: { userId: session.userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete subscription");
    return NextResponse.json(
      { error: "Failed to delete subscription" },
      { status: 500 }
    );
  }
}
