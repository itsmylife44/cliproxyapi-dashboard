import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { isUserAdmin } from "@/lib/auth/admin";
import { validateOrigin } from "@/lib/auth/origin";
import { apiError, ERROR_CODE, Errors } from "@/lib/errors";
import { z } from "zod";
import {
  executeAccountReset,
  inspectAccountResetCredits,
  loadAutoResetRules,
  resolveAuthMetaByIndex,
  upsertAutoResetRule,
} from "@/lib/quota/auto-reset";
import { isAutoResetSupportedProvider } from "@/lib/quota/auto-reset-rules";

const UpdateRuleSchema = z.object({
  authIndex: z.string().min(1).max(128),
  enabled: z.boolean(),
  fiveHourThresholdPct: z.number().min(0).max(100).default(0),
  weeklyThresholdPct: z.number().min(0).max(100).default(0),
  minWeeklyDaysLeft: z.number().min(0).max(7).default(0),
});

const ActionSchema = z.object({
  action: z.enum(["check_credits", "reset_now"]),
  authIndex: z.string().min(1).max(128),
});

async function authorizeResetManagement() {
  const session = await verifySession();
  if (!session) return Errors.unauthorized();
  if (!await isUserAdmin(session.userId)) return Errors.forbidden();
}

export async function GET() {
  const denied = await authorizeResetManagement();
  if (denied) return denied;

  try {
    return NextResponse.json({ rules: await loadAutoResetRules() });
  } catch (error) {
    return Errors.internal("Failed to load auto-reset rules", error);
  }
}

export async function PUT(request: NextRequest) {
  const originError = validateOrigin(request);
  if (originError) return originError;

  const denied = await authorizeResetManagement();
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = UpdateRuleSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(ERROR_CODE.VALIDATION_ERROR, "Invalid auto-reset rule payload", 400);
    }

    const { authIndex, ...settings } = parsed.data;
    if (settings.enabled) {
      const account = await resolveAuthMetaByIndex(authIndex);
      if (!account || account.disabled || !isAutoResetSupportedProvider(account.provider)) {
        return Errors.validation("Account does not support automated usage resets");
      }
    }
    return NextResponse.json({ rule: await upsertAutoResetRule(authIndex, settings) });
  } catch (error) {
    return Errors.internal("Failed to update auto-reset rule", error);
  }
}

export async function POST(request: NextRequest) {
  const originError = validateOrigin(request);
  if (originError) return originError;

  const denied = await authorizeResetManagement();
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(ERROR_CODE.VALIDATION_ERROR, "Invalid auto-reset action payload", 400);
    }

    const meta = await resolveAuthMetaByIndex(parsed.data.authIndex);
    if (!meta?.provider || meta.disabled || !isAutoResetSupportedProvider(meta.provider)) {
      return Errors.validation("Account does not support usage resets");
    }

    const target = {
      auth_index: parsed.data.authIndex,
      provider: meta.provider,
      accountId: meta.id_token?.chatgpt_account_id,
    };

    if (parsed.data.action === "check_credits") {
      const summary = await inspectAccountResetCredits(target);
      return NextResponse.json(summary);
    }

    const resetResult = await executeAccountReset(target);
    if (!resetResult) return apiError(ERROR_CODE.VALIDATION_ERROR, "A reset was already attempted recently", 409);
    return NextResponse.json(resetResult, { status: resetResult.ok ? 200 : 400 });
  } catch (error) {
    return Errors.internal("Failed to process auto-reset action", error);
  }
}
