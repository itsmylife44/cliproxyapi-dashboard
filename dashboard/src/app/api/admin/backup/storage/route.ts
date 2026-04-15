import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Errors, apiSuccess } from "@/lib/errors";
import { getStorageInfo } from "@/lib/backup";

/**
 * GET /api/admin/backup/storage - Get storage information
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
    const storage = await getStorageInfo();
    return apiSuccess({ storage });
  } catch (error) {
    return Errors.internal("Failed to get storage info", error);
  }
}
