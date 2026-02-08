import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { logger } from "./logger";

export const AUDIT_ACTION = {
  USER_CREATED: "USER_CREATED",
  USER_DELETED: "USER_DELETED",
  API_KEY_REVOKED: "API_KEY_REVOKED",
  PROVIDER_KEY_ADDED: "PROVIDER_KEY_ADDED",
  PROVIDER_KEY_REMOVED: "PROVIDER_KEY_REMOVED",
  CUSTOM_PROVIDER_CREATED: "CUSTOM_PROVIDER_CREATED",
  CUSTOM_PROVIDER_DELETED: "CUSTOM_PROVIDER_DELETED",
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
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
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
  } catch (error) {
    logger.error({ err: error, ...params }, "Audit logging failed");
  }
}

export function logAuditAsync(params: AuditParams): void {
  logAudit(params).catch(() => {});
}
