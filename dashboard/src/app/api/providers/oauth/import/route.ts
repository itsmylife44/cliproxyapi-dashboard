import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { importOAuthCredential } from "@/lib/providers/dual-write";
import { OAUTH_PROVIDER, type OAuthProvider } from "@/lib/providers/constants";
import { ImportOAuthCredentialSchema, formatZodError } from "@/lib/validation/schemas";
import { logger } from "@/lib/logger";

function isValidOAuthProvider(provider: string): provider is OAuthProvider {
  return Object.values(OAUTH_PROVIDER).includes(provider as OAuthProvider);
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ImportOAuthCredentialSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 });
  }

  const { provider, fileName, fileContent } = parsed.data;

  if (!isValidOAuthProvider(provider)) {
    return NextResponse.json(
      { error: `Invalid OAuth provider: ${provider}. Valid providers: ${Object.values(OAUTH_PROVIDER).join(", ")}` },
      { status: 400 }
    );
  }

  // Basic JSON validation
  try {
    const parsed = JSON.parse(fileContent);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json(
        { error: "Credential file must contain a valid JSON object" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "File content is not valid JSON" },
      { status: 400 }
    );
  }

  try {
    const result = await importOAuthCredential(
      session.userId,
      provider,
      fileName,
      fileContent
    );

    if (!result.ok) {
      if (result.error?.includes("already exists") || result.error?.includes("already imported")) {
        return NextResponse.json({ error: result.error }, { status: 409 });
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(
      { id: result.id, accountName: result.accountName },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, "POST /api/providers/oauth/import error");
    return NextResponse.json(
      { error: "Failed to import OAuth credential" },
      { status: 500 }
    );
  }
}
