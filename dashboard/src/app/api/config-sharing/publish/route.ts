import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { generateShareCode } from "@/lib/share-code";
import { Errors } from "@/lib/errors";
import { prisma } from "@/lib/db";

interface PublishResponse {
  id: string;
  shareCode: string;
  name: string;
  isActive: boolean;
  subscriberCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CreatePublishRequest {
  name?: string;
}

interface UpdatePublishRequest {
  name?: string;
  isActive?: boolean;
}

function isCreatePublishRequest(body: unknown): body is CreatePublishRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) return true;
  
  const obj = body as Record<string, unknown>;
  
  if (obj.name !== undefined && typeof obj.name !== "string") return false;
  
  return true;
}

function isUpdatePublishRequest(body: unknown): body is UpdatePublishRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  
  const obj = body as Record<string, unknown>;
  
  if (obj.name !== undefined && typeof obj.name !== "string") return false;
  if (obj.isActive !== undefined && typeof obj.isActive !== "boolean") return false;
  
  const hasValidField = obj.name !== undefined || obj.isActive !== undefined;
  
  return hasValidField;
}

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  try {
    const template = await prisma.configTemplate.findUnique({
      where: { userId: session.userId },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    if (!template) {
      return Errors.notFound("Template");
    }

    const response: PublishResponse = {
      id: template.id,
      shareCode: template.shareCode,
      name: template.name,
      isActive: template.isActive,
      subscriberCount: template._count.subscriptions,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    return Errors.internal("Failed to fetch config template", error);
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

  const rateLimit = checkRateLimitWithPreset(request, "config-publish", "CONFIG_SHARING");
  if (!rateLimit.allowed) {
    return Errors.rateLimited(rateLimit.retryAfterSeconds);
  }

  try {
    const body = await request.json();

    if (!isCreatePublishRequest(body)) {
      return Errors.validation("Invalid request body");
    }

    const existingTemplate = await prisma.configTemplate.findUnique({
      where: { userId: session.userId },
    });

    if (existingTemplate) {
      return Errors.conflict("User already has a published template");
    }

    const shareCode = generateShareCode();
    const name = body.name && body.name.trim() ? body.name.trim() : "My Config";

    const template = await prisma.configTemplate.create({
      data: {
        userId: session.userId,
        shareCode,
        name,
      },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    const response: PublishResponse = {
      id: template.id,
      shareCode: template.shareCode,
      name: template.name,
      isActive: template.isActive,
      subscriberCount: template._count.subscriptions,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return Errors.internal("Failed to create config template", error);
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
    
    if (!isUpdatePublishRequest(body)) {
      return Errors.validation("Invalid request body");
    }

    const existingTemplate = await prisma.configTemplate.findUnique({
      where: { userId: session.userId },
    });

    if (!existingTemplate) {
      return Errors.notFound("Template");
    }

    const updateData: { name?: string; isActive?: boolean } = {};
    
    if (body.name !== undefined && body.name.trim()) {
      updateData.name = body.name.trim();
    }
    
    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    const template = await prisma.configTemplate.update({
      where: { userId: session.userId },
      data: updateData,
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    const response: PublishResponse = {
      id: template.id,
      shareCode: template.shareCode,
      name: template.name,
      isActive: template.isActive,
      subscriberCount: template._count.subscriptions,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    return Errors.internal("Failed to update config template", error);
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
    const existingTemplate = await prisma.configTemplate.findUnique({
      where: { userId: session.userId },
    });

    if (!existingTemplate) {
      return Errors.notFound("Template");
    }

    await prisma.configTemplate.delete({
      where: { userId: session.userId },
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return Errors.internal("Failed to delete config template", error);
  }
}
