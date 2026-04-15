import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Errors, apiSuccess } from "@/lib/errors";
import { getRestorePreview, MAX_BACKUP_SIZE } from "@/lib/backup";

/**
 * POST /api/admin/backup/preview - Get restore preview from uploaded file
 */
export async function POST(request: Request) {
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
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Errors.validation("No file provided");
    }

    // Check file size
    if (file.size > MAX_BACKUP_SIZE) {
      return Errors.validation(`File too large. Maximum size: ${Math.round(MAX_BACKUP_SIZE / 1024 / 1024)}MB`);
    }

    // Check file extension
    if (!file.name.endsWith(".json.gz")) {
      return Errors.validation("Invalid file type. Must be a .json.gz backup file");
    }

    // Read file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get preview
    const preview = await getRestorePreview(buffer);

    return apiSuccess({ preview });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Invalid backup") || error.message.includes("Unsupported backup")) {
        return Errors.validation(error.message);
      }
    }
    return Errors.internal("Failed to preview backup", error);
  }
}
