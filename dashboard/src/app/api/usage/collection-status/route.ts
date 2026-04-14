import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess, ERROR_CODE } from "@/lib/errors";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return apiError(ERROR_CODE.AUTH_UNAUTHORIZED, "Unauthorized", 401);
  }

  try {
    const collectorState = await prisma.collectorState.findUnique({
      where: { id: "singleton" },
      select: {
        lastCollectedAt: true,
        lastStatus: true,
        errorMessage: true,
        recordsStored: true,
        updatedAt: true,
      },
    });

    // If no collector state exists yet, return default idle state
    if (!collectorState) {
      return apiSuccess({
        lastCollectedAt: null,
        lastStatus: "idle",
        errorMessage: null,
        recordsStored: 0,
        isHealthy: false,
        consecutiveFailures: 0,
      });
    }

    // Calculate health status based on last collection time and status
    const now = Date.now();
    const lastCollectedMs = collectorState.lastCollectedAt.getTime();
    const minutesSinceLastCollection = Math.floor((now - lastCollectedMs) / 60000);
    
    // Consider healthy if:
    // - Last status was success
    // - Collection ran within the last 10 minutes
    const isHealthy = 
      collectorState.lastStatus === "success" && 
      minutesSinceLastCollection <= 10;

    // Count consecutive failures by looking at error messages
    // For simplicity, we'll use the current status (could be enhanced with failure count tracking)
    const consecutiveFailures = collectorState.lastStatus === "error" ? 1 : 0;

    return apiSuccess({
      lastCollectedAt: collectorState.lastCollectedAt.toISOString(),
      lastStatus: collectorState.lastStatus,
      errorMessage: collectorState.errorMessage,
      recordsStored: collectorState.recordsStored,
      isHealthy,
      consecutiveFailures,
    });
  } catch (error) {
    console.error("Failed to fetch collector status:", error);
    return apiError(ERROR_CODE.DATABASE_ERROR, "Failed to fetch collector status", 500);
  }
}