import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { logger } from "./logger";

export const AUDIT_ACTION = {
  USER_LOGIN: "USER_LOGIN",
  USER_CREATED: "USER_CREATED",
  USER_DELETED: "USER_DELETED",
  API_KEY_REVOKED: "API_KEY_REVOKED",
  PROVIDER_KEY_ADDED: "PROVIDER_KEY_ADDED",
  PROVIDER_KEY_REMOVED: "PROVIDER_KEY_REMOVED",
  CUSTOM_PROVIDER_CREATED: "CUSTOM_PROVIDER_CREATED",
  CUSTOM_PROVIDER_UPDATED: "CUSTOM_PROVIDER_UPDATED",
  CUSTOM_PROVIDER_DELETED: "CUSTOM_PROVIDER_DELETED",
  CUSTOM_PROVIDER_REORDERED: "CUSTOM_PROVIDER_REORDERED",
  PROVIDER_GROUP_CREATED: "PROVIDER_GROUP_CREATED",
  PROVIDER_GROUP_UPDATED: "PROVIDER_GROUP_UPDATED",
  PROVIDER_GROUP_DELETED: "PROVIDER_GROUP_DELETED",
  PROVIDER_GROUP_TOGGLED: "PROVIDER_GROUP_TOGGLED",
  SETTINGS_CHANGED: "SETTINGS_CHANGED",
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

interface AuditParams {
  userId: string;
  action: AuditAction;
  target?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export function extractIpAddress(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const via = request.headers.get("via");
  
  const isBehindProxy = via !== null || request.headers.get("x-forwarded-proto") !== null;
  
  if (isBehindProxy && forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  
  if (isBehindProxy && realIp) {
    return realIp;
  }
  
  return "direct";
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        target: params.target,
        metadata: params.metadata
          ? (params.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        ipAddress: params.ipAddress,
      },
    });

    logger.info({
      audit: true,
      action: params.action,
      userId: params.userId,
      target: params.target,
      ip: params.ipAddress,
      metadata: params.metadata,
    }, `Audit: ${params.action}`);
  } catch (error) {
    logger.error({ err: error, ...params }, "Audit logging failed");
  }
}

export function logAuditAsync(params: AuditParams): void {
  logAudit(params).catch(() => {});
}
