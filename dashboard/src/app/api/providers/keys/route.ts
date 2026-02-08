import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { contributeKey, listKeysWithOwnership } from "@/lib/providers/dual-write";
import { PROVIDER, type Provider } from "@/lib/providers/constants";

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    if (!provider || !isValidProvider(provider)) {
      return NextResponse.json(
        { error: "Invalid or missing provider parameter" },
        { status: 400 }
      );
    }

    const result = await listKeysWithOwnership(session.userId, provider);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ keys: result.keys });
  } catch (error) {
    console.error("GET /api/providers/keys error:", error);
    return NextResponse.json(
      { error: "Failed to fetch provider keys" },
      { status: 500 }
    );
  }
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

  try {
    const body = await request.json();

    if (!isContributeKeyRequest(body)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (!isValidProvider(body.provider)) {
      return NextResponse.json(
        { error: "Invalid provider" },
        { status: 400 }
      );
    }

      const result = await contributeKey(session.userId, body.provider, body.apiKey);

     if (!result.ok) {
       if (result.error?.includes("already contributed")) {
         return NextResponse.json({ error: result.error }, { status: 409 });
       }
       if (result.error?.includes("limit reached")) {
         return NextResponse.json({ error: result.error }, { status: 403 });
       }
       return NextResponse.json({ error: result.error }, { status: 500 });
     }

      return NextResponse.json(
        {
          keyHash: result.keyHash,
          keyIdentifier: result.keyIdentifier,
        },
        { status: 201 }
      );
  } catch (error) {
    console.error("POST /api/providers/keys error:", error);
    return NextResponse.json(
      { error: "Failed to contribute provider key" },
      { status: 500 }
    );
  }
}
