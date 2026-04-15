import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { readBackupFile } from "@/lib/backup";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/backup/[id]/download - Download backup file
 */
export async function GET(_request: Request, { params }: RouteParams) {
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

  const { id } = await params;

  try {
    // Get backup record
    const backup = await prisma.backupRecord.findUnique({
      where: { id },
    });

    if (!backup) {
      return Errors.notFound("Backup");
    }

    if (backup.status !== "COMPLETED") {
      return Errors.validation("Backup is not ready for download");
    }

    // Read file
    const fileBuffer = await readBackupFile(backup.filename);

    // Verify checksum if available
    if (backup.checksum) {
      const actualChecksum = createHash("sha256").update(fileBuffer).digest("hex");
      if (actualChecksum !== backup.checksum) {
        return Errors.internal("Backup file corrupted - checksum mismatch");
      }
    }

    // Return as downloadable file
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${backup.filename}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Errors.notFound("Backup file");
    }
    return Errors.internal("Failed to download backup", error);
  }
}
