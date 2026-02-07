import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import type { McpEntry } from "@/lib/config-generators/opencode";

interface UserConfigRequest {
  mcpServers?: McpEntry[];
  customPlugins?: string[];
}

function isMcpEntry(value: unknown): value is McpEntry {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  
  if (typeof obj.name !== "string" || !obj.name) return false;
  if (typeof obj.type !== "string") return false;
  
  if (obj.type === "stdio") {
    return typeof obj.command === "string";
  }
  
  if (obj.type === "http") {
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
  
  return result;
}

export async function GET(_request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    console.error("Failed to fetch user config:", error);
    return NextResponse.json(
      { error: "Failed to fetch config" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
    const validatedConfig = validateUserConfigRequest(body);
    
    if (!validatedConfig) {
      return NextResponse.json(
        { error: "Invalid config data" },
        { status: 400 }
      );
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
    
    return NextResponse.json({
      success: true,
      overrides: override.overrides,
    });
  } catch (error) {
    console.error("Failed to update user config:", error);
    return NextResponse.json(
      { error: "Failed to update config" },
      { status: 500 }
    );
  }
}
