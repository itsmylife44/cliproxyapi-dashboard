import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import type { McpEntry } from "@/lib/config-generators/opencode";
import { Errors, apiSuccess } from "@/lib/errors";

interface UserConfigRequest {
  mcpServers?: McpEntry[];
  customPlugins?: string[];
  defaultModel?: string;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((v) => typeof v === "string");
}

function isMcpEntry(value: unknown): value is McpEntry {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  
  if (typeof obj.name !== "string" || !obj.name) return false;
  if (typeof obj.type !== "string") return false;
  
  // Validate optional shared fields
  if (obj.enabled !== undefined && typeof obj.enabled !== "boolean") return false;
  if (obj.environment !== undefined && !isStringRecord(obj.environment)) return false;
  
  if (obj.type === "local") {
    return Array.isArray(obj.command) && obj.command.every((c) => typeof c === "string");
  }
  
  if (obj.type === "remote") {
    return typeof obj.url === "string";
  }
  
  return false;
}

function validateUserConfigRequest(body: unknown): UserConfigRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  
  const obj = body as Record<string, unknown>;
  const result: UserConfigRequest = {};
  
  if (obj.mcpServers !== undefined) {
    if (!Array.isArray(obj.mcpServers)) return null;
    const mcpServers = obj.mcpServers.filter(isMcpEntry);
    if (mcpServers.length !== obj.mcpServers.length) return null;
    result.mcpServers = mcpServers;
  }
  
  if (obj.customPlugins !== undefined) {
    if (!Array.isArray(obj.customPlugins)) return null;
    const customPlugins = obj.customPlugins.filter((v): v is string => typeof v === "string" && v.length > 0);
    if (customPlugins.length !== obj.customPlugins.length) return null;
    result.customPlugins = customPlugins;
  }

  if (obj.defaultModel !== undefined) {
    if (typeof obj.defaultModel !== "string") return null;
    const trimmed = obj.defaultModel.trim();
    if (trimmed.length > 0) {
      result.defaultModel = trimmed;
    }
  }
  
  return result;
}

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }
  
  try {
    const override = await prisma.agentModelOverride.findUnique({
      where: { userId: session.userId },
    });
    
    if (!override) {
      return NextResponse.json({});
    }
    
    const overrides = override.overrides as Record<string, unknown>;
    return NextResponse.json(overrides);
  } catch (error) {
    return Errors.internal("Failed to fetch user config", error);
  }
}

export async function PUT(request: NextRequest) {
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
    const validatedConfig = validateUserConfigRequest(body);
    
    if (!validatedConfig) {
      return Errors.validation("Invalid config data");
    }
    
    const userExists = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true },
    });
    
    if (!userExists) {
      return Errors.notFound("User");
    }

    const existing = await prisma.agentModelOverride.findUnique({
      where: { userId: session.userId },
    });
    
    const existingOverrides = (existing?.overrides as Record<string, unknown>) ?? {};
    
    const updatedOverrides: Record<string, unknown> = { ...existingOverrides };
    
    if (validatedConfig.mcpServers !== undefined) {
      updatedOverrides.mcpServers = validatedConfig.mcpServers;
    }
    
    if (validatedConfig.customPlugins !== undefined) {
      updatedOverrides.customPlugins = validatedConfig.customPlugins;
    }

    if (validatedConfig.defaultModel !== undefined) {
      updatedOverrides.defaultModel = validatedConfig.defaultModel;
    }
    
    const override = await prisma.agentModelOverride.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        overrides: JSON.parse(JSON.stringify(updatedOverrides)),
      },
      update: {
        overrides: JSON.parse(JSON.stringify(updatedOverrides)),
      },
    });
    
    return apiSuccess({
      overrides: override.overrides as Record<string, unknown>,
    });
  } catch (error) {
    return Errors.internal("Failed to update user config", error);
  }
}
