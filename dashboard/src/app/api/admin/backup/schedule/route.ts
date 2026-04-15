import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Errors, apiSuccess } from "@/lib/errors";
import { getScheduleConfig, updateScheduleConfig } from "@/lib/backup";

/**
 * Basic cron expression validation
 * Format: minute hour day month weekday
 */
function isValidCronExpression(expr: string): boolean {
  // Basic cron format: 5 space-separated fields
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  
  // Each field should be: number, *, or valid range/list
  const fieldPattern = /^(\*|(\d+|\*)(-\d+)?(\/\d+)?(,(\d+|\*)(-\d+)?(\/\d+)?)*|\d+)$/;
  return parts.every(part => fieldPattern.test(part));
}

/**
 * GET /api/admin/backup/schedule - Get backup schedule configuration
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
    const schedule = await getScheduleConfig();
    return apiSuccess({ schedule });
  } catch (error) {
    return Errors.internal("Failed to get schedule", error);
  }
}

/**
 * PUT /api/admin/backup/schedule - Update backup schedule configuration
 */
export async function PUT(request: Request) {
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
    const body = await request.json();
    const { enabled, cronExpr, retention } = body;

    // Basic validation
    if (cronExpr !== undefined) {
      if (typeof cronExpr !== "string" || !isValidCronExpression(cronExpr)) {
        return Errors.validation("Invalid cron expression. Use format: minute hour day month weekday (e.g., '0 3 * * *')");
      }
    }

    if (retention !== undefined && (typeof retention !== "number" || retention < 1 || retention > 365)) {
      return Errors.validation("Retention must be between 1 and 365 days");
    }

    const schedule = await updateScheduleConfig({
      enabled,
      cronExpr,
      retention,
    });

    return apiSuccess({ schedule });
  } catch (error) {
    return Errors.internal("Failed to update schedule", error);
  }
}
