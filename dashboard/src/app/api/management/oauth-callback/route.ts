import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

const PROVIDERS = {
  CLAUDE: "claude",
  GEMINI_CLI: "gemini-cli",
  CODEX: "codex",
  ANTIGRAVITY: "antigravity",
} as const;

type Provider = (typeof PROVIDERS)[keyof typeof PROVIDERS];

const CLIPROXYAPI_BASE = process.env.CLIPROXYAPI_MANAGEMENT_URL?.replace("/v0/management", "") || "http://cliproxyapi:8317";
const CLIPROXYAPI_MANAGEMENT_URL = process.env.CLIPROXYAPI_MANAGEMENT_URL || "http://cliproxyapi:8317/v0/management";
const MANAGEMENT_API_KEY = process.env.MANAGEMENT_API_KEY;

const CALLBACK_PATHS: Record<Provider, string> = {
  [PROVIDERS.CLAUDE]: `${CLIPROXYAPI_BASE}/anthropic/callback`,
  [PROVIDERS.GEMINI_CLI]: `${CLIPROXYAPI_BASE}/google/callback`,
  [PROVIDERS.CODEX]: `${CLIPROXYAPI_BASE}/codex/callback`,
  [PROVIDERS.ANTIGRAVITY]: `${CLIPROXYAPI_BASE}/antigravity/callback`,
};

interface OAuthCallbackRequestBody {
  provider: Provider;
  callbackUrl: string;
}

interface OAuthCallbackResponse {
  status: number;
}

interface AuthFileEntry {
  name: string;
  provider?: string;
  type?: string;
  email?: string;
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

const fetchAuthFiles = async (): Promise<AuthFileEntry[] | null> => {
  if (!MANAGEMENT_API_KEY) return null;

  try {
    const response = await fetch(`${CLIPROXYAPI_MANAGEMENT_URL}/auth-files`, {
      method: "GET",
      headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
    });

    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (!isRecord(data) || !Array.isArray(data.files)) return null;

    const files = data.files.filter(
      (entry): entry is AuthFileEntry => isRecord(entry) && typeof entry.name === "string"
    );

    return files;
  } catch {
    return null;
  }
};

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

   const beforeAuthFiles = await fetchAuthFiles();
   const beforeNames = new Set((beforeAuthFiles || []).map((file) => file.name));

   try {
     const response = await fetch(callbackTarget.toString(), { method: "GET" });

     if (response.ok) {
       // Poll for new auth files (CLIProxyAPI creates them asynchronously after callback)
       let candidateFiles: AuthFileEntry[] = [];
       const MAX_RETRIES = 10;
       const RETRY_DELAY_MS = 1500;

       for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
         await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

          const afterAuthFiles = await fetchAuthFiles();

          if (afterAuthFiles) {
           candidateFiles = afterAuthFiles.filter((file) => {
             const fileProvider = file.provider || file.type;
             const providerMatches = !fileProvider || fileProvider === provider;
              const isNew = !beforeNames.has(file.name);
              return isNew && providerMatches;
           });
         }

          if (candidateFiles.length > 0) {
            break;
         }
       }

        if (candidateFiles.length === 0) {
          console.warn("OAuth callback: no new auth files detected after polling");
        }

        // Try to atomically claim exactly ONE new file
        // Uses Prisma unique constraint on accountName as the race guard
        let claimed = false;
        for (const file of candidateFiles) {
          if (claimed) break;
          try {
            await prisma.providerOAuthOwnership.create({
              data: {
                userId: session.userId,
                provider,
                accountName: file.name,
                accountEmail: file.email || null,
              },
            });
            claimed = true;
          } catch (e) {
            // P2002 = another user already claimed this account - try next
            if (
              e instanceof Prisma.PrismaClientKnownRequestError &&
              e.code === "P2002"
            ) {
              continue;
            }
            throw e; // Re-throw unexpected errors
          }
        }
      }

    const payload: OAuthCallbackResponse = { status: response.status };

    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: "Failed to relay OAuth callback" },
      { status: 502 }
    );
  }
}
