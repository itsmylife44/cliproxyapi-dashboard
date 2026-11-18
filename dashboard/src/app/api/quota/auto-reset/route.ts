import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { apiError, ERROR_CODE, Errors } from "@/lib/errors";
import { z } from "zod";
import {
  executeAccountReset,
  inspectAccountResetCredits,
  loadAutoResetRules,
  normalizeAutoResetProvider,
  resolveAuthMetaByIndex,
  upsertAutoResetRule,
} from "@/lib/quota/auto-reset";

const UpdateRuleSchema = z.object({
  authIndex: z.string().min(1).max(128),
  enabled: z.boolean(),
  fiveHourThresholdPct: z.number().min(0).max(100).default(0),
  weeklyThresholdPct: z.number().min(0).max(100).default(0),
});

const ActionSchema = z.object({
  action: z.enum(["check_credits", "reset_now"]),
  authIndex: z.string().min(1).max(128),
  provider: z.string().optional(),
});

export async function GET() {
  const session = await verifySession();
  if (!session) return Errors.unauthorized();

  const rules = await loadAutoResetRules();
  return NextResponse.json({ rules });
}

export async function PUT(request: NextRequest) {
  const originError = validateOrigin(request);
  if (originError) return originError;

  const session = await verifySession();
  if (!session) return Errors.unauthorized();

  try {
    const body = await request.json();
    const parsed = UpdateRuleSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(ERROR_CODE.VALIDATION_ERROR, "Invalid auto-reset rule payload", 400);
    }

    const { authIndex, enabled, fiveHourThresholdPct, weeklyThresholdPct } = parsed.data;
    const result = await upsertAutoResetRule(authIndex, {
      enabled,
      fiveHourThresholdPct,
      weeklyThresholdPct,
    });

    return NextResponse.json(result);
  } catch (error) {
    return Errors.internal("Failed to update auto-reset rule", error);
  }
}

export async function POST(request: NextRequest) {
  const originError = validateOrigin(request);
  if (originError) return originError;

  const session = await verifySession();
  if (!session) return Errors.unauthorized();

  try {
    const body = await request.json();
    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(ERROR_CODE.VALIDATION_ERROR, "Invalid auto-reset action payload", 400);
    }

    const meta = await resolveAuthMetaByIndex(parsed.data.authIndex);
    const metaProvider =
      meta?.provider && meta.provider.toLowerCase() !== "unknown" ? meta.provider : undefined;
    const provider = metaProvider ?? parsed.data.provider ?? "";
    if (normalizeAutoResetProvider(provider) === "unsupported") {
      return apiError(ERROR_CODE.VALIDATION_ERROR, "Account does not support automated usage resets", 400);
    }

    const target = {
      auth_index: parsed.data.authIndex,
      provider,
      accountId: meta?.id_token?.chatgpt_account_id,
    };

    if (parsed.data.action === "check_credits") {
      const summary = await inspectAccountResetCredits(target);
      return NextResponse.json(summary);
    }

    const resetResult = await executeAccountReset(target);
    if (resetResult.ok) {
      await upsertAutoResetRule(parsed.data.authIndex, {
        lastResetAt: new Date().toISOString(),
        lastStatus: resetResult.status,
      });
    }
    return NextResponse.json(resetResult, { status: resetResult.ok ? 200 : 400 });
  } catch (error) {
    return Errors.internal("Failed to process auto-reset action", error);
  }
}
