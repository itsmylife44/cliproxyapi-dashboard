import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { Errors } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";

const PROVIDERS = {
  CLAUDE: "claude",
  GEMINI_CLI: "gemini-cli",
  CODEX: "codex",
  ANTIGRAVITY: "antigravity",
  IFLOW: "iflow",
  QWEN: "qwen",
  KIMI: "kimi",
  COPILOT: "copilot",
  KIRO: "kiro",
  CURSOR: "cursor",
  CODEBUDDY: "codebuddy",
} as const;

type Provider = (typeof PROVIDERS)[keyof typeof PROVIDERS];

const PROVIDERS_WITH_CALLBACK = new Set<Provider>([
  PROVIDERS.CLAUDE,
  PROVIDERS.GEMINI_CLI,
  PROVIDERS.CODEX,
  PROVIDERS.ANTIGRAVITY,
  PROVIDERS.IFLOW,
]);

const PROVIDER_MATCH_ALIASES: Record<Provider, readonly string[]> = {
  [PROVIDERS.CLAUDE]: ["claude", "anthropic"],
  [PROVIDERS.GEMINI_CLI]: ["gemini-cli", "gemini"],
  [PROVIDERS.CODEX]: ["codex", "openai"],
  [PROVIDERS.ANTIGRAVITY]: ["antigravity"],
  [PROVIDERS.IFLOW]: ["iflow"],
  [PROVIDERS.QWEN]: ["qwen"],
  [PROVIDERS.KIMI]: ["kimi"],
  [PROVIDERS.COPILOT]: ["copilot", "github", "github-copilot"],
  [PROVIDERS.KIRO]: ["kiro"],
  [PROVIDERS.CURSOR]: ["cursor"],
  [PROVIDERS.CODEBUDDY]: ["codebuddy"],
};

const CLIPROXYAPI_BASE = process.env.CLIPROXYAPI_MANAGEMENT_URL?.replace("/v0/management", "") || "http://cliproxyapi:8317";
const CLIPROXYAPI_MANAGEMENT_URL = process.env.CLIPROXYAPI_MANAGEMENT_URL || "http://cliproxyapi:8317/v0/management";
const MANAGEMENT_API_KEY = process.env.MANAGEMENT_API_KEY;

const CALLBACK_PATHS: Partial<Record<Provider, string>> = {
  [PROVIDERS.CLAUDE]: `${CLIPROXYAPI_BASE}/anthropic/callback`,
  [PROVIDERS.GEMINI_CLI]: `${CLIPROXYAPI_BASE}/google/callback`,
  [PROVIDERS.CODEX]: `${CLIPROXYAPI_BASE}/codex/callback`,
  [PROVIDERS.ANTIGRAVITY]: `${CLIPROXYAPI_BASE}/antigravity/callback`,
  [PROVIDERS.IFLOW]: `${CLIPROXYAPI_BASE}/iflow/callback`,
};

interface OAuthCallbackRequestBody {
  provider: Provider;
  callbackUrl?: string;
  state?: string;
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

const matchesAuthFileProvider = (
  provider: Provider,
  fileProviderRaw: string,
  fileNameRaw: string
) => {
  const aliases = PROVIDER_MATCH_ALIASES[provider];
  const fileProvider = fileProviderRaw.toLowerCase();
  const fileName = fileNameRaw.toLowerCase();
  return aliases.some((alias) => fileProvider === alias || fileName.includes(alias));
};

const parseRequestBody = (body: unknown): OAuthCallbackRequestBody | null => {
  if (!isRecord(body)) return null;
  const provider = body.provider;
  const callbackUrl = body.callbackUrl;
  const state = body.state;
  if (!isProvider(provider)) return null;
  if (callbackUrl !== undefined && typeof callbackUrl !== "string") return null;
  if (state !== undefined && typeof state !== "string") return null;
  return {
    provider,
    callbackUrl: typeof callbackUrl === "string" ? callbackUrl : undefined,
    state: typeof state === "string" ? state : undefined,
  };
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

    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }

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

/**
 * Find new auth files by comparing before/after snapshots.
 * Primary strategy: snapshot-diff is provider-agnostic and works regardless
 * of how CLIProxyAPIPlus names the auth file.
 */
const findNewAuthFilesByDiff = (
  before: AuthFileEntry[],
  after: AuthFileEntry[],
  provider: Provider
): AuthFileEntry[] => {
  const beforeNames = new Set(before.map((f) => f.name));

  return after.filter((file) => {
    if (beforeNames.has(file.name)) return false;

    const fileProvider = (file.provider || file.type || "").toLowerCase();
    const fileNameLower = file.name.toLowerCase();
    return matchesAuthFileProvider(provider, fileProvider, fileNameLower);
  });
};

/**
 * Find auth files matching the OAuth state in the filename.
 * Fallback strategy for providers that embed state in auth file names.
 */
const findAuthFilesByState = (
  files: AuthFileEntry[],
  provider: Provider,
  resolvedState: string | undefined
): AuthFileEntry[] => {
  return files.filter((file) => {
    const fileNameLower = file.name.toLowerCase();
    const fileProvider = (file.provider || file.type || "").toLowerCase();

    if (!matchesAuthFileProvider(provider, fileProvider, fileNameLower)) {
      return false;
    }

    if (!resolvedState) return true;

    return file.name.includes(resolvedState) ||
      fileNameLower.includes(resolvedState.toLowerCase());
  });
};

/**
 * Find unclaimed auth files matching the provider that have no ownership record.
 * Last-resort fallback: if only one unclaimed file exists for this provider, claim it.
 */
const findUnclaimedAuthFiles = async (
  files: AuthFileEntry[],
  provider: Provider
): Promise<AuthFileEntry[]> => {
  const providerFiles = files.filter((file) => {
    const fileProvider = (file.provider || file.type || "").toLowerCase();
    const fileNameLower = file.name.toLowerCase();
    return matchesAuthFileProvider(provider, fileProvider, fileNameLower);
  });

  if (providerFiles.length === 0) return [];

  const existingOwnerships = await prisma.providerOAuthOwnership.findMany({
    where: { accountName: { in: providerFiles.map((f) => f.name) } },
    select: { accountName: true },
  });

  const ownedNames = new Set(existingOwnerships.map((o) => o.accountName));
  return providerFiles.filter((f) => !ownedNames.has(f.name));
};

export async function POST(request: NextRequest) {
  const session = await verifySession();

  if (!session) {
    return Errors.unauthorized();
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  const rateLimit = checkRateLimitWithPreset(request, "oauth-callback", "OAUTH_CALLBACK");
  if (!rateLimit.allowed) {
    return Errors.rateLimited(rateLimit.retryAfterSeconds);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Errors.validation("Invalid JSON");
  }

  const parsedBody = parseRequestBody(rawBody);
  if (!parsedBody) {
    return Errors.validation("Invalid request body");
  }

  const { provider, callbackUrl, state } = parsedBody;

  try {
    let responseStatus = 200;
    let resolvedState = state;

    const preCallbackFiles = await fetchAuthFiles();
    const preCallbackNames = preCallbackFiles
      ? new Set(preCallbackFiles.map((f) => f.name))
      : null;

    if (PROVIDERS_WITH_CALLBACK.has(provider)) {
      if (!callbackUrl) {
        return Errors.validation("Callback URL is required for this provider");
      }

      const callbackParams = extractCallbackParams(callbackUrl);
      if (!callbackParams) {
        return Errors.validation("Callback URL must include code and state");
      }

      const callbackPath = CALLBACK_PATHS[provider];
      if (!callbackPath) {
        return Errors.internal("OAuth callback endpoint is not configured");
      }

      const callbackTarget = new URL(callbackPath);
      callbackTarget.searchParams.set("code", callbackParams.code);
      callbackTarget.searchParams.set("state", callbackParams.state);
      resolvedState = callbackParams.state;

      const response = await fetch(callbackTarget.toString(), { method: "GET" });
      responseStatus = response.status;

      if (!response.ok) {
        await response.body?.cancel();
        const payload: OAuthCallbackResponse = { status: responseStatus };
        return NextResponse.json(payload, { status: responseStatus });
      }
    } else if (!resolvedState) {
      return Errors.validation("State is required for this provider");
    }

    let candidateFiles: AuthFileEntry[] = [];
    const MAX_RETRIES = 10;
    const RETRY_DELAY_MS = 1500;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

      const afterAuthFiles = await fetchAuthFiles();
      if (!afterAuthFiles) continue;

      if (preCallbackFiles) {
        const diffCandidates = findNewAuthFilesByDiff(preCallbackFiles, afterAuthFiles, provider);
        if (diffCandidates.length > 0) {
          candidateFiles = diffCandidates;
          logger.info(
            { provider, strategy: "snapshot-diff", count: diffCandidates.length },
            "OAuth callback: matched new auth file via snapshot diff"
          );
          break;
        }
      }

      const stateCandidates = findAuthFilesByState(afterAuthFiles, provider, resolvedState);
      if (stateCandidates.length > 0) {
        candidateFiles = stateCandidates;
        logger.info(
          { provider, strategy: "state-match", count: stateCandidates.length },
          "OAuth callback: matched auth file via state in filename"
        );
        break;
      }

      // For non-callback providers (e.g. Cursor, CodeBuddy), the auth file is
      // written by the browser flow *before* POST /oauth-callback is called, so
      // preCallbackFiles is always stale and snapshot-diff yields nothing.
      // Run unclaimed detection on every attempt for these providers so we
      // can claim on attempt 1 rather than waiting until attempt 8+.
      const runUnclaimed =
        !PROVIDERS_WITH_CALLBACK.has(provider) || attempt >= MAX_RETRIES - 2;

      if (runUnclaimed) {
        const unclaimedCandidates = await findUnclaimedAuthFiles(afterAuthFiles, provider);
        const [unclaimedCandidate] = unclaimedCandidates;
        if (unclaimedCandidates.length === 1 && unclaimedCandidate) {
          candidateFiles = unclaimedCandidates;
          logger.info(
            { provider, strategy: "unclaimed-single", name: unclaimedCandidate.name },
            "OAuth callback: matched single unclaimed auth file for provider"
          );
          break;
        }

        if (unclaimedCandidates.length > 1 && preCallbackNames) {
          const newAndUnclaimed = unclaimedCandidates.filter(
            (f) => !preCallbackNames.has(f.name)
          );
          const [newUnclaimedCandidate] = newAndUnclaimed;
          if (newAndUnclaimed.length === 1 && newUnclaimedCandidate) {
            candidateFiles = newAndUnclaimed;
            logger.info(
              { provider, strategy: "unclaimed-new", name: newUnclaimedCandidate.name },
              "OAuth callback: matched single new unclaimed auth file"
            );
            break;
          }
        }
      }
    }

    if (candidateFiles.length === 0) {
      logger.warn(
        { provider, state: resolvedState || null, preSnapshotCount: preCallbackFiles?.length ?? -1 },
        "OAuth callback: auth file not yet available, client should retry"
      );
      return NextResponse.json({ status: 202 }, { status: 202 });
    }

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
        logger.info(
          { provider, accountName: file.name, userId: session.userId },
          "OAuth callback: ownership claimed successfully"
        );
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          continue;
        }
        throw e;
      }
    }

    if (!claimed) {
      logger.warn(
        { provider, candidateCount: candidateFiles.length, userId: session.userId },
        "OAuth callback: all candidate files already owned"
      );
      return NextResponse.json({ status: 409 }, { status: 409 });
    }

    const payload: OAuthCallbackResponse = { status: responseStatus };

    return NextResponse.json(payload, { status: responseStatus });
  } catch (error) {
    return Errors.internal("Failed to relay OAuth callback", error);
  }
}
