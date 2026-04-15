import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { atomicMergeOverrides } from "@/lib/db/optimistic-merge";
import type { McpEntry } from "@/lib/config-generators/opencode";
import { Errors, apiSuccess, apiError, ERROR_CODE } from "@/lib/errors";

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

    // Build updates object from validated config
    const updates: Record<string, unknown> = {};
    
    if (validatedConfig.mcpServers !== undefined) {
      updates.mcpServers = validatedConfig.mcpServers;
    }
    
    if (validatedConfig.customPlugins !== undefined) {
      updates.customPlugins = validatedConfig.customPlugins;
    }

    if (validatedConfig.defaultModel !== undefined) {
      updates.defaultModel = validatedConfig.defaultModel;
    }

    // Use optimistic concurrency control to prevent race condition data loss
    const result = await atomicMergeOverrides(session.userId, updates);

    if (!result.success) {
      return apiError(
        ERROR_CODE.RESOURCE_ALREADY_EXISTS,
        "Config update conflict, please retry",
        409
      );
    }
    
    return apiSuccess({
      overrides: result.overrides,
    });
  } catch (error) {
    return Errors.internal("Failed to update user config", error);
  }
}
