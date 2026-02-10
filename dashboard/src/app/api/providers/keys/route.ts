import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { contributeKey, listKeysWithOwnership } from "@/lib/providers/dual-write";
import { PROVIDER, type Provider } from "@/lib/providers/constants";
import { ERROR_CODE, Errors, apiError } from "@/lib/errors";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";

interface ContributeKeyRequest {
  provider: string;
  apiKey: string;
}

function isContributeKeyRequest(body: unknown): body is ContributeKeyRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;

  const obj = body as Record<string, unknown>;

  if (typeof obj.provider !== "string") return false;
  if (typeof obj.apiKey !== "string") return false;

  return true;
}

function isValidProvider(provider: string): provider is Provider {
  return Object.values(PROVIDER).includes(provider as Provider);
}

export async function GET(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    if (!provider || !isValidProvider(provider)) {
      return apiError(
        ERROR_CODE.PROVIDER_INVALID,
        "Invalid or missing provider parameter",
        400
      );
    }

    const result = await listKeysWithOwnership(session.userId, provider);

    if (!result.ok) {
      return apiError(ERROR_CODE.PROVIDER_ERROR, result.error ?? "Provider error", 500);
    }

    return NextResponse.json({ data: { keys: result.keys } });
  } catch (error) {
    return Errors.internal("GET /api/providers/keys error", error);
  }
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const body = await request.json();

    if (!isContributeKeyRequest(body)) {
      return Errors.validation("Invalid request body");
    }

    if (!isValidProvider(body.provider)) {
      return apiError(ERROR_CODE.PROVIDER_INVALID, "Invalid provider", 400);
    }

    const result = await contributeKey(session.userId, body.provider, body.apiKey);

    if (!result.ok) {
      if (result.error?.includes("already contributed")) {
        return apiError(ERROR_CODE.KEY_ALREADY_EXISTS, result.error, 409);
      }
      if (result.error?.includes("limit reached")) {
        return apiError(ERROR_CODE.LIMIT_REACHED, result.error, 403);
      }
      return apiError(ERROR_CODE.PROVIDER_ERROR, result.error ?? "Provider error", 500);
    }

    logAuditAsync({
      userId: session.userId,
      action: AUDIT_ACTION.PROVIDER_KEY_ADDED,
      target: body.provider,
      metadata: { keyIdentifier: result.keyIdentifier },
      ipAddress: extractIpAddress(request),
    });

    return NextResponse.json(
      {
        data: {
          keyHash: result.keyHash,
          keyIdentifier: result.keyIdentifier,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return Errors.internal("POST /api/providers/keys error", error);
  }
}
