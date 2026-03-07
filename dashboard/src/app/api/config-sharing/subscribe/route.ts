import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { normalizeShareCode } from "@/lib/share-code";
import { Errors } from "@/lib/errors";
import { prisma } from "@/lib/db";

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
    return Errors.unauthorized();
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
    return Errors.internal("Failed to fetch subscription", error);
  }
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  const rateLimit = checkRateLimitWithPreset(request, "config-subscribe", "CONFIG_SHARING");
  if (!rateLimit.allowed) {
    return Errors.rateLimited(rateLimit.retryAfterSeconds);
  }

  try {
    const body = await request.json();

    if (!isSubscribeRequest(body)) {
      return Errors.validation("shareCode is required");
    }

    if (!body.shareCode) {
      return Errors.missingFields(["shareCode"]);
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
      return Errors.notFound("Template");
    }

    if (!template.isActive) {
      return Errors.validation("Template is not active");
    }

    if (template.userId === session.userId) {
      return Errors.validation("Cannot subscribe to your own template");
    }

    const userApiKeys = await prisma.userApiKey.findMany({
      where: { userId: session.userId },
      select: { id: true },
      take: 1,
    });

    if (userApiKeys.length === 0) {
      return Errors.validation("Cannot subscribe without at least one API key. Please add an API key first.");
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
    return Errors.internal("Failed to create subscription", error);
  }
}

export async function PATCH(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const body = await request.json();
    
    if (!isUpdateSubscriptionRequest(body)) {
      return Errors.validation("isActive is required");
    }

    const existingSubscription = await prisma.configSubscription.findUnique({
      where: { userId: session.userId },
    });

    if (!existingSubscription) {
      return Errors.notFound("Subscription");
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
    return Errors.internal("Failed to update subscription", error);
  }
}

export async function DELETE(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
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
      return Errors.notFound("Subscription");
    }

    await prisma.configSubscription.delete({
      where: { userId: session.userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return Errors.internal("Failed to delete subscription", error);
  }
}
