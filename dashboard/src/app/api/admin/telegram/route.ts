import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  sendTelegramMessage,
  validateBotToken,
  validateChatId,
} from "@/lib/telegram";
import { sendDiscordAlert, validDiscordWebhook } from "@/lib/quota-alerts";

const SETTING_KEYS = {
  BOT_TOKEN: "telegram_bot_token",
  CHAT_ID: "telegram_chat_id",
  THRESHOLD: "telegram_quota_threshold",
  ENABLED: "telegram_alerts_enabled",
  PROVIDERS: "telegram_alert_providers",
  CHECK_INTERVAL: "telegram_check_interval",
  COOLDOWN: "telegram_cooldown",
  CHANNEL: "quota_alert_channel",
  WEBHOOK: "discord_quota_webhook",
} as const;

async function requireAdmin(): Promise<
  { userId: string; username: string } | NextResponse
> {
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

function maskToken(token: string): string {
  if (token.length <= 4) return "****";
  return "*".repeat(token.length - 4) + token.slice(-4);
}

export async function GET() {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            SETTING_KEYS.BOT_TOKEN,
            SETTING_KEYS.CHAT_ID,
            SETTING_KEYS.THRESHOLD,
            SETTING_KEYS.ENABLED,
            SETTING_KEYS.PROVIDERS,
            SETTING_KEYS.CHECK_INTERVAL,
            SETTING_KEYS.COOLDOWN,
            SETTING_KEYS.CHANNEL,
            SETTING_KEYS.WEBHOOK,
          ],
        },
      },
    });

    const settingMap = new Map(settings.map((s) => [s.key, s.value]));

    const rawToken = settingMap.get(SETTING_KEYS.BOT_TOKEN) ?? "";
    const chatId = settingMap.get(SETTING_KEYS.CHAT_ID) ?? "";
    const threshold = parseInt(
      settingMap.get(SETTING_KEYS.THRESHOLD) ?? "20",
      10
    );
    const enabled = settingMap.get(SETTING_KEYS.ENABLED) === "true";

    const providersRaw = settingMap.get(SETTING_KEYS.PROVIDERS) ?? "";
    const providers = providersRaw ? providersRaw.split(",").filter(Boolean) : [];

    const checkIntervalRaw = parseInt(settingMap.get(SETTING_KEYS.CHECK_INTERVAL) ?? "", 10);
    const cooldownRaw = parseInt(settingMap.get(SETTING_KEYS.COOLDOWN) ?? "", 10);

    return NextResponse.json({
      botToken: rawToken ? maskToken(rawToken) : "",
      chatId,
      threshold: Number.isNaN(threshold) ? 20 : threshold,
      enabled,
      channel: settingMap.get(SETTING_KEYS.CHANNEL) ?? (enabled ? "telegram" : "disabled"),
      webhook: settingMap.get(SETTING_KEYS.WEBHOOK) ? "********" : "",
      providers,
      checkInterval: !Number.isNaN(checkIntervalRaw) ? checkIntervalRaw : 5,
      cooldown: !Number.isNaN(cooldownRaw) ? cooldownRaw : 60,
    });
  } catch (error) {
    return Errors.internal("fetch telegram settings", error);
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { botToken, chatId, threshold, enabled } = body;
    const { channel, webhook } = body;
    if (channel !== undefined && !["disabled", "telegram", "discord"].includes(String(channel))) return Errors.validation("Invalid alert channel");
    if (webhook !== undefined && (typeof webhook !== "string" || (webhook && !webhook.startsWith("*") && !validDiscordWebhook(webhook)))) return Errors.validation("Invalid Discord webhook URL");

    // Validate botToken if provided and not masked
    if (
      botToken !== undefined &&
      typeof botToken === "string" &&
      botToken.length > 0 &&
      !botToken.startsWith("*")
    ) {
      if (!validateBotToken(botToken)) {
        return Errors.validation(
          "Invalid bot token format. Expected format: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ_0123456789a"
        );
      }
    }

    // Validate chatId if provided
    if (chatId !== undefined && typeof chatId === "string" && chatId.length > 0) {
      if (!validateChatId(chatId)) {
        return Errors.validation(
          "Invalid chat ID. Must be a numeric value (can be negative for groups)."
        );
      }
    }

    // Validate threshold if provided
    if (threshold !== undefined) {
      const thresholdStr = String(threshold);
      if (!/^\d+$/.test(thresholdStr)) {
        return Errors.validation("Threshold must be a valid integer.");
      }
      const thresholdNum = parseInt(thresholdStr, 10);
      if (
        Number.isNaN(thresholdNum) ||
        !Number.isInteger(thresholdNum) ||
        thresholdNum < 1 ||
        thresholdNum > 100
      ) {
        return Errors.validation("Threshold must be an integer between 1 and 100.");
      }
    }

    // Validate checkInterval if provided (in minutes)
    const { checkInterval, cooldown } = body;
    if (checkInterval !== undefined) {
      const val = Number(checkInterval);
      if (!Number.isInteger(val) || val < 1 || val > 1440) {
        return Errors.validation("Check interval must be an integer between 1 and 1440 minutes.");
      }
    }

    // Validate cooldown if provided (in minutes)
    if (cooldown !== undefined) {
      const val = Number(cooldown);
      if (!Number.isInteger(val) || val < 1 || val > 1440) {
        return Errors.validation("Cooldown must be an integer between 1 and 1440 minutes.");
      }
    }

    // Upsert each provided setting
    const updates: Array<{ key: string; value: string }> = [];
    if (typeof channel === "string") updates.push({ key: SETTING_KEYS.CHANNEL, value: channel });
    if (typeof webhook === "string" && !webhook.startsWith("*")) updates.push({ key: SETTING_KEYS.WEBHOOK, value: webhook });

    if (
      botToken !== undefined &&
      typeof botToken === "string" &&
      botToken.length > 0 &&
      !botToken.startsWith("*")
    ) {
      updates.push({ key: SETTING_KEYS.BOT_TOKEN, value: botToken });
    }

    if (chatId !== undefined && typeof chatId === "string") {
      updates.push({ key: SETTING_KEYS.CHAT_ID, value: chatId });
    }

    if (threshold !== undefined) {
      const thresholdStr = String(threshold);
      const thresholdVal = parseInt(thresholdStr, 10);
      updates.push({
        key: SETTING_KEYS.THRESHOLD,
        value: String(thresholdVal),
      });
    }

    if (enabled !== undefined && typeof enabled === "boolean") {
      updates.push({
        key: SETTING_KEYS.ENABLED,
        value: String(enabled),
      });
    }

    // Save providers if provided
    const { providers } = body;
    if (Array.isArray(providers)) {
      const validProviders = providers.filter((p): p is string => typeof p === "string" && p.length > 0);
      updates.push({
        key: SETTING_KEYS.PROVIDERS,
        value: validProviders.join(","),
      });
    }

    // Save check interval if provided
    if (checkInterval !== undefined) {
      updates.push({
        key: SETTING_KEYS.CHECK_INTERVAL,
        value: String(Number(checkInterval)),
      });
    }

    // Save cooldown if provided
    if (cooldown !== undefined) {
      updates.push({
        key: SETTING_KEYS.COOLDOWN,
        value: String(Number(cooldown)),
      });
    }

    await prisma.$transaction(
      updates.map(({ key, value }) =>
        prisma.systemSetting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        })
      )
    );

    logAuditAsync({
      userId: authResult.userId,
      action: AUDIT_ACTION.TELEGRAM_SETTINGS_CHANGED,
      target: "telegram_settings",
      metadata: {
        updatedKeys: updates.map((u) => u.key),
      },
      ipAddress: extractIpAddress(request),
    });

    logger.info(
      { userId: authResult.userId, updatedKeys: updates.map((u) => u.key) },
      "Telegram settings updated"
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return Errors.internal("update telegram settings", error);
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [SETTING_KEYS.BOT_TOKEN, SETTING_KEYS.CHAT_ID, SETTING_KEYS.CHANNEL, SETTING_KEYS.WEBHOOK, SETTING_KEYS.ENABLED],
        },
      },
    });

    const settingMap = new Map(settings.map((s) => [s.key, s.value]));
    const botToken = settingMap.get(SETTING_KEYS.BOT_TOKEN);
    const chatId = settingMap.get(SETTING_KEYS.CHAT_ID);
    const channel = settingMap.get(SETTING_KEYS.CHANNEL) ?? (settingMap.get(SETTING_KEYS.ENABLED) === "true" ? "telegram" : "disabled");
    if (channel === "discord") {
      const result = await sendDiscordAlert(settingMap.get(SETTING_KEYS.WEBHOOK) ?? "", "CLIProxyAPI Dashboard: Discord alerts are working.");
      return result.ok ? NextResponse.json({ success: true }) : Errors.validation(result.error ?? "Discord test failed");
    }

    if (!botToken || !chatId) {
      return Errors.validation(
        "Bot token and chat ID must be configured before sending a test message."
      );
    }

    const result = await sendTelegramMessage(
      botToken,
      chatId,
      "✅ <b>CLIProxyAPI Dashboard</b>\n\nTelegram alerts are working correctly!",
      "HTML"
    );

    if (!result.ok) {
      return Errors.validation(`Failed to send test message: ${result.error}`);
    }

    logger.info(
      { userId: authResult.userId },
      "Telegram test message sent successfully"
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return Errors.internal("send telegram test message", error);
  }
}
