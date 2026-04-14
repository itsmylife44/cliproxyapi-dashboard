import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";
import { Errors } from "@/lib/errors";
import { getBackupFilePath, deleteBackup } from "@/lib/backup/backup-service";
import * as fs from "node:fs";

async function requireAdmin(): Promise<{ userId: string; username: string } | NextResponse> {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return Errors.forbidden();
  }

  return { userId: session.userId, username: session.username };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  try {
    const result = await getBackupFilePath(id);
    if (!result) {
      return Errors.notFound("Backup");
    }

    const fileBuffer = fs.readFileSync(result.filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": String(fileBuffer.byteLength),
      },
    });
  } catch (error) {
    return Errors.internal("download backup", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const originError = validateOrigin(request);
  if (originError) return originError;

  const { id } = await params;

  try {
    const deleted = await deleteBackup(id);
    if (!deleted) {
      return Errors.notFound("Backup");
    }

    logAuditAsync({
      userId: authResult.userId,
      action: AUDIT_ACTION.BACKUP_DELETED,
      target: id,
      ipAddress: extractIpAddress(request),
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return Errors.internal("delete backup", error);
  }
}