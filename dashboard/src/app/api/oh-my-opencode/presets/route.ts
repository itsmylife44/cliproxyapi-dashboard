import { Errors, apiSuccess } from "@/lib/errors";
import { verifySession } from "@/lib/auth/session";
import { loadOfficialOhMyOpenCodePresets } from "@/lib/config-generators/oh-my-opencode-presets";

export async function GET() {
  try {
    const session = await verifySession();
    if (!session) {
      return Errors.unauthorized();
    }

    const presets = await loadOfficialOhMyOpenCodePresets();
    return apiSuccess({ presets });
  } catch (error) {
    return Errors.internal("Failed to load OhMyOpenAgent presets", error);
  }
}
