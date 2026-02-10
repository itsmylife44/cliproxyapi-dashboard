import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const MAX_PROVIDER_KEYS_PER_USER_KEY = "max_provider_keys_per_user";
const DEFAULT_MAX_PROVIDER_KEYS_PER_USER = 10;

export async function getMaxProviderKeysPerUser(): Promise<number> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: MAX_PROVIDER_KEYS_PER_USER_KEY },
    });

    if (!setting) {
      return DEFAULT_MAX_PROVIDER_KEYS_PER_USER;
    }

    const parsed = parseInt(setting.value, 10);
    if (isNaN(parsed) || parsed <= 0) {
      return DEFAULT_MAX_PROVIDER_KEYS_PER_USER;
    }

    return parsed;
  } catch (error) {
    logger.error({ err: error }, "Failed to get max provider keys per user setting");
    return DEFAULT_MAX_PROVIDER_KEYS_PER_USER;
  }
}
