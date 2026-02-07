import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { generateShareCode } from "@/lib/share-code";
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

export async function GET(_request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
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
    console.error("Failed to fetch config template:", error);
    return NextResponse.json(
      { error: "Failed to fetch config template" },
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
    
    if (!isCreatePublishRequest(body)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const existingTemplate = await prisma.configTemplate.findUnique({
      where: { userId: session.userId },
    });

    if (existingTemplate) {
      return NextResponse.json(
        { error: "User already has a published template" },
        { status: 409 }
      );
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
    console.error("Failed to create config template:", error);
    return NextResponse.json(
      { error: "Failed to create config template" },
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
    
    if (!isUpdatePublishRequest(body)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const existingTemplate = await prisma.configTemplate.findUnique({
      where: { userId: session.userId },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
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
    console.error("Failed to update config template:", error);
    return NextResponse.json(
      { error: "Failed to update config template" },
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
    const existingTemplate = await prisma.configTemplate.findUnique({
      where: { userId: session.userId },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    await prisma.configTemplate.delete({
      where: { userId: session.userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete config template:", error);
    return NextResponse.json(
      { error: "Failed to delete config template" },
      { status: 500 }
    );
  }
}
