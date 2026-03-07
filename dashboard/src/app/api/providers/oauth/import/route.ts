import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { importOAuthCredential } from "@/lib/providers/dual-write";
import { OAUTH_PROVIDER, type OAuthProvider } from "@/lib/providers/constants";
import { ImportOAuthCredentialSchema } from "@/lib/validation/schemas";
import { ERROR_CODE, Errors, apiError } from "@/lib/errors";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";
import { apiSuccess } from "@/lib/api-response";

function isValidOAuthProvider(provider: string): provider is OAuthProvider {
  return Object.values(OAUTH_PROVIDER).includes(provider as OAuthProvider);
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

  const rateLimit = checkRateLimitWithPreset(request, "oauth-import", "OAUTH_IMPORT");
  if (!rateLimit.allowed) {
    return Errors.rateLimited(rateLimit.retryAfterSeconds);
  }

  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return Errors.validation("Invalid JSON request body");
    }

    const parsed = ImportOAuthCredentialSchema.safeParse(rawBody);
    if (!parsed.success) {
      return Errors.zodValidation(parsed.error.issues);
    }

    const { provider, fileName, fileContent } = parsed.data;

    if (!isValidOAuthProvider(provider)) {
      return apiError(
        ERROR_CODE.PROVIDER_INVALID,
        `Invalid OAuth provider: ${provider}. Valid providers: ${Object.values(OAUTH_PROVIDER).join(", ")}`,
        400
      );
    }

    // Validate credential JSON structure
    try {
      const credentialJson = JSON.parse(fileContent);
      if (!credentialJson || typeof credentialJson !== "object" || Array.isArray(credentialJson)) {
        return Errors.validation("Credential file must contain a valid JSON object");
      }
    } catch {
      return Errors.validation("File content is not valid JSON");
    }

    const result = await importOAuthCredential(
      session.userId,
      provider,
      fileName,
      fileContent
    );

    if (!result.ok) {
      if (result.error?.includes("already exists") || result.error?.includes("already imported")) {
        return apiError(ERROR_CODE.RESOURCE_ALREADY_EXISTS, result.error, 409);
      }
      return apiError(ERROR_CODE.PROVIDER_ERROR, result.error ?? "Import failed", 500);
    }

    logAuditAsync({
      userId: session.userId,
      action: AUDIT_ACTION.OAUTH_CREDENTIAL_IMPORTED,
      target: provider,
      metadata: { fileName, accountName: result.accountName },
      ipAddress: extractIpAddress(request),
    });

    return apiSuccess({
      id: result.id,
      accountName: result.accountName,
    }, undefined, 201);
  } catch (error) {
    return Errors.internal("POST /api/providers/oauth/import error", error);
  }
}
