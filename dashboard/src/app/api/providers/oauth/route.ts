import { verifySession } from "@/lib/auth/session";
import { listOAuthWithOwnership } from "@/lib/providers/dual-write";
import { listEnabledPluginOAuthProviders } from "@/lib/providers/plugins";
import { ERROR_CODE, Errors, apiError, apiSuccess } from "@/lib/errors";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    const isAdmin = user?.isAdmin ?? false;

    const [result, pluginOAuthProviders] = await Promise.all([
      listOAuthWithOwnership(session.userId, isAdmin),
      listEnabledPluginOAuthProviders(),
    ]);

    if (!result.ok) {
      return apiError(ERROR_CODE.PROVIDER_ERROR, result.error ?? "Provider error", 500);
    }

    return apiSuccess({ accounts: result.accounts, pluginOAuthProviders });
  } catch (error) {
    return Errors.internal("GET /api/providers/oauth error", error);
  }
}
