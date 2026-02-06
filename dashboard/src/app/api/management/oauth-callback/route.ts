import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";

const PROVIDERS = {
  CLAUDE: "claude",
  GEMINI_CLI: "gemini-cli",
  CODEX: "codex",
  ANTIGRAVITY: "antigravity",
} as const;

type Provider = (typeof PROVIDERS)[keyof typeof PROVIDERS];

const CALLBACK_PATHS: Record<Provider, string> = {
  [PROVIDERS.CLAUDE]: "http://cliproxyapi:8317/anthropic/callback",
  [PROVIDERS.GEMINI_CLI]: "http://cliproxyapi:8317/google/callback",
  [PROVIDERS.CODEX]: "http://cliproxyapi:8317/codex/callback",
  [PROVIDERS.ANTIGRAVITY]: "http://cliproxyapi:8317/antigravity/callback",
};

interface OAuthCallbackRequestBody {
  provider: Provider;
  callbackUrl: string;
}

interface OAuthCallbackResponse {
  status: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isProvider = (value: unknown): value is Provider =>
  Object.values(PROVIDERS).includes(value as Provider);

const parseRequestBody = (body: unknown): OAuthCallbackRequestBody | null => {
  if (!isRecord(body)) return null;
  const provider = body.provider;
  const callbackUrl = body.callbackUrl;
  if (!isProvider(provider)) return null;
  if (typeof callbackUrl !== "string" || callbackUrl.length === 0) return null;
  return { provider, callbackUrl };
};

const extractCallbackParams = (callbackUrl: string) => {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(callbackUrl);
  } catch {
    return null;
  }

  const code = parsedUrl.searchParams.get("code");
  const state = parsedUrl.searchParams.get("state");
  if (!code || !state) return null;

  return { code, state };
};

export async function POST(request: NextRequest) {
  const session = await verifySession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsedBody = parseRequestBody(rawBody);
  if (!parsedBody) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { provider, callbackUrl } = parsedBody;
  const callbackParams = extractCallbackParams(callbackUrl);
  if (!callbackParams) {
    return NextResponse.json(
      { error: "Callback URL must include code and state" },
      { status: 400 }
    );
  }

  const callbackPath = CALLBACK_PATHS[provider];
  const callbackTarget = new URL(callbackPath);
  callbackTarget.searchParams.set("code", callbackParams.code);
  callbackTarget.searchParams.set("state", callbackParams.state);

  try {
    const response = await fetch(callbackTarget.toString(), { method: "GET" });
    const payload: OAuthCallbackResponse = { status: response.status };

    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: "Failed to relay OAuth callback" },
      { status: 502 }
    );
  }
}
