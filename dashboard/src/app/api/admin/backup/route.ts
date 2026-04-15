import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Errors, apiSuccess } from "@/lib/errors";
import {
  createBackup,
  listBackups,
  deleteBackup,
} from "@/lib/backup";

/**
 * GET /api/admin/backup - List all backups
 */
export async function GET() {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  // Check admin
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return Errors.forbidden();
  }

  try {
    const backups = await listBackups();
    return apiSuccess({ backups });
  } catch (error) {
    return Errors.internal("Failed to list backups", error);
  }
}

/**
 * POST /api/admin/backup - Create a new backup
 */
export async function POST() {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  // Check admin
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return Errors.forbidden();
  }

  try {
    const backup = await createBackup(session.userId, "MANUAL");
    return apiSuccess({
      backup: {
        id: backup.id,
        filename: backup.filename,
        sizeBytes: backup.sizeBytes.toString(),
        status: backup.status,
        type: backup.type,
        createdAt: backup.createdAt.toISOString(),
        completedAt: backup.completedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    return Errors.internal("Failed to create backup", error);
  }
}

/**
 * DELETE /api/admin/backup - Delete a backup
 */
export async function DELETE(request: Request) {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  // Check admin
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return Errors.forbidden();
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Errors.validation("Backup ID is required");
    }

    await deleteBackup(id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Backup not found") {
      return Errors.notFound("Backup");
    }
    return Errors.internal("Failed to delete backup", error);
  }
}
