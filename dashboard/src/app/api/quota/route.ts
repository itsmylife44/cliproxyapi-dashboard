import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

const CLIPROXYAPI_MANAGEMENT_URL =
  process.env.CLIPROXYAPI_MANAGEMENT_URL ||
  "http://cliproxyapi:8317/v0/management";
const MANAGEMENT_API_KEY = process.env.MANAGEMENT_API_KEY;

interface AuthFile {
  auth_index: string | number;
  provider: string;
  email?: string;
  name?: string;
  label?: string;
  disabled: boolean;
  status: string;
}

interface AuthFilesResponse {
  files: AuthFile[];
}

interface AntigravityModel {
  displayName: string;
  quotaInfo?: {
    remainingFraction: number;
    resetTime: string | null;
  };
}

interface AntigravityResponse {
  models: Record<string, AntigravityModel>;
}

interface QuotaGroup {
  id: string;
  label: string;
  remainingFraction: number;
  resetTime: string | null;
  models: Array<{
    id: string;
    displayName: string;
    remainingFraction: number;
    resetTime: string | null;
  }>;
}

interface QuotaAccount {
  auth_index: string;
  provider: string;
  email: string;
  supported: boolean;
  error?: string;
  groups?: QuotaGroup[];
  raw?: unknown;
}

interface QuotaResponse {
  accounts: QuotaAccount[];
}

interface ApiCallResponse {
  status_code?: number;
  statusCode?: number;
  header?: Record<string, string[] | string>;
  headers?: Record<string, string[] | string>;
  body?: unknown;
}

interface ClaudeUsageWindow {
  utilization?: number;
  resets_at?: string | null;
}

interface ClaudeOAuthUsageResponse {
  five_hour?: ClaudeUsageWindow;
  seven_day?: ClaudeUsageWindow;
  seven_day_sonnet?: ClaudeUsageWindow;
  seven_day_opus?: ClaudeUsageWindow;
  extra_usage?: {
    is_enabled?: boolean;
    utilization?: number;
    monthly_limit?: number;
    used_credits?: number;
  };
}

const MODEL_GROUPS = {
  "Claude/GPT": ["claude", "gpt"],
  "Gemini 3 Pro": ["gemini-3-pro"],
  "Gemini 2.5 Flash": ["gemini-2.5-flash"],
  "Gemini 3 Flash": ["gemini-3-flash"],
  "Gemini 2.5 Pro": ["gemini-2.5-pro"],
  Other: [],
} as const;

function categorizeModel(modelId: string): string {
  const lowerModelId = modelId.toLowerCase();
  
  for (const [groupName, identifiers] of Object.entries(MODEL_GROUPS)) {
    if (groupName === "Other") continue;
    if (identifiers.some((id) => lowerModelId.includes(id))) {
      return groupName;
    }
  }
  
  return "Other";
}

function groupAntigravityModels(
  models: Record<string, AntigravityModel>
): QuotaGroup[] {
  const groups: Record<
    string,
    {
      id: string;
      label: string;
      models: Array<{
        id: string;
        displayName: string;
        remainingFraction: number;
        resetTime: string | null;
      }>;
    }
  > = {};

  for (const [modelId, modelData] of Object.entries(models)) {
    if (!modelData.quotaInfo) continue;

    const groupName = categorizeModel(modelId);
    
    if (!groups[groupName]) {
      groups[groupName] = {
        id: groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        label: groupName,
        models: [],
      };
    }

    groups[groupName].models.push({
      id: modelId,
      displayName: modelData.displayName,
      remainingFraction: modelData.quotaInfo.remainingFraction,
      resetTime: modelData.quotaInfo.resetTime,
    });
  }

  return Object.values(groups).map((group) => {
    const remainingFraction = Math.min(
      ...group.models.map((m) => m.remainingFraction)
    );
    
    const resetTimes = group.models
      .map((m) => m.resetTime)
      .filter((rt): rt is string => rt !== null);
    const resetTime = resetTimes.length > 0
      ? resetTimes.sort()[0]
      : null;

    return {
      ...group,
      remainingFraction,
      resetTime,
    };
  });
}

async function fetchAntigravityQuota(
  authIndex: string
): Promise<QuotaGroup[] | { error: string }> {
  try {
    const response = await fetch(`${CLIPROXYAPI_MANAGEMENT_URL}/api-call`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MANAGEMENT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_index: authIndex,
        method: "POST",
        url: "https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
        header: {
          Authorization: "Bearer $TOKEN$",
          "Content-Type": "application/json",
          "User-Agent": "antigravity/1.11.5 windows/amd64",
        },
        data: "{}",
      }),
    });

    if (!response.ok) {
      return { error: `API call failed: ${response.status}` };
    }

    const apiCallResult = (await response.json()) as ApiCallResponse | AntigravityResponse;

    if ("status_code" in apiCallResult || "statusCode" in apiCallResult) {
      const statusCode = Number(apiCallResult.status_code ?? apiCallResult.statusCode ?? 0);
      if (statusCode < 200 || statusCode >= 300) {
        return { error: `Provider API failed: ${statusCode}` };
      }

      let parsedBody: unknown = apiCallResult.body;
      if (typeof parsedBody === "string") {
        try {
          parsedBody = JSON.parse(parsedBody);
        } catch {
          return { error: "Invalid provider response body" };
        }
      }

      const data = parsedBody as AntigravityResponse;
      if (!data.models || typeof data.models !== "object") {
        return { error: "Invalid Antigravity quota payload" };
      }

      return groupAntigravityModels(data.models);
    }

    const directData = apiCallResult as AntigravityResponse;
    if (!directData.models || typeof directData.models !== "object") {
      return { error: "Invalid Antigravity quota payload" };
    }

    return groupAntigravityModels(directData.models);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

interface CodexRateWindow {
  limit_window_seconds?: number;
  used_percent?: number;
  reset_at?: number;
}

interface CodexWhamUsageResponse {
  rate_limit?: {
    primary_window?: CodexRateWindow;
    secondary_window?: CodexRateWindow;
  };
  plan_type?: string;
}

function formatWindowLabel(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m Window`;
  return `${Math.round(minutes / 60)}h Window`;
}

function parseCodexQuota(data: CodexWhamUsageResponse): QuotaGroup[] {
  const groups: QuotaGroup[] = [];

  const windows: Array<{ key: string; label: string; window: CodexRateWindow | undefined }> = [
    { key: "primary", label: "Primary", window: data.rate_limit?.primary_window },
    { key: "secondary", label: "Secondary", window: data.rate_limit?.secondary_window },
  ];

  for (const { key, window } of windows) {
    if (!window || window.used_percent === undefined) continue;

    const remainingFraction = Math.max(0, Math.min(1, 1 - window.used_percent / 100));
    const resetTime = window.reset_at
      ? new Date(window.reset_at * 1000).toISOString()
      : null;
    const label = window.limit_window_seconds
      ? formatWindowLabel(window.limit_window_seconds)
      : `${key.charAt(0).toUpperCase() + key.slice(1)} Window`;

    groups.push({
      id: `${key}-window`,
      label,
      remainingFraction,
      resetTime,
      models: [
        {
          id: `${key}-window`,
          displayName: label,
          remainingFraction,
          resetTime,
        },
      ],
    });
  }

  return groups;
}

async function fetchCodexQuota(
  authIndex: string
): Promise<QuotaGroup[] | { error: string }> {
  try {
    const response = await fetch(`${CLIPROXYAPI_MANAGEMENT_URL}/api-call`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MANAGEMENT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_index: authIndex,
        method: "GET",
        url: "https://chatgpt.com/backend-api/wham/usage",
        header: {
          Authorization: "Bearer $TOKEN$",
          "User-Agent": "codex-cli/1.0.0",
        },
      }),
    });

    if (!response.ok) {
      return { error: `API call failed: ${response.status}` };
    }

    const apiCallResult = (await response.json()) as ApiCallResponse | CodexWhamUsageResponse;

    let parsedBody: unknown;

    if (
      typeof apiCallResult === "object" &&
      apiCallResult !== null &&
      ("status_code" in apiCallResult || "statusCode" in apiCallResult)
    ) {
      const typedResult = apiCallResult as ApiCallResponse;
      const statusCode = Number(typedResult.status_code ?? typedResult.statusCode ?? 0);
      if (statusCode < 200 || statusCode >= 300) {
        return { error: `Provider API failed: ${statusCode}` };
      }

      if (typeof typedResult.body === "string") {
        try {
          parsedBody = JSON.parse(typedResult.body);
        } catch {
          return { error: "Invalid provider response body" };
        }
      } else {
        parsedBody = typedResult.body;
      }
    } else {
      parsedBody = apiCallResult;
    }

    const data = parsedBody as CodexWhamUsageResponse;
    const groups = parseCodexQuota(data);

    if (groups.length === 0) {
      return { error: "No Codex quota windows found" };
    }

    return groups;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function fetchKimiQuota(
  authIndex: string
): Promise<QuotaGroup[] | { error: string }> {
  try {
    const response = await fetch(`${CLIPROXYAPI_MANAGEMENT_URL}/api-call`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MANAGEMENT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_index: authIndex,
        method: "POST",
        url: "https://api.kimi.com/coding/v1/chat/completions",
        header: {
          Authorization: "Bearer $TOKEN$",
          "Content-Type": "application/json",
          "User-Agent": "KimiCLI/1.10.6",
          "X-Msh-Platform": "kimi_cli",
          "X-Msh-Version": "1.10.6",
        },
        data: JSON.stringify({
          model: "kimi-k2",
          max_tokens: 1,
          messages: [{ role: "user", content: "1" }],
        }),
      }),
    });

    if (!response.ok) {
      return { error: `API call failed: ${response.status}` };
    }

    const apiCallResult = (await response.json()) as ApiCallResponse;
    const statusCode = Number(apiCallResult.status_code ?? apiCallResult.statusCode ?? 0);

    if (statusCode < 200 || statusCode >= 300) {
      return { error: `Provider API failed: ${statusCode}` };
    }

    // Kimi has no rate-limit headers or quota API — a successful response means the account is active
    const body = parseApiCallBody(apiCallResult);
    const usage = (body as Record<string, unknown>)?.usage as
      | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      | undefined;

    const groups: QuotaGroup[] = [
      {
        id: "kimi-status",
        label: "Account Status",
        remainingFraction: 1,
        resetTime: null,
        models: [
          {
            id: "kimi-k2",
            displayName: "Kimi K2",
            remainingFraction: 1,
            resetTime: null,
          },
          {
            id: "kimi-k2-thinking",
            displayName: "Kimi K2 Thinking",
            remainingFraction: 1,
            resetTime: null,
          },
          {
            id: "kimi-k2.5",
            displayName: "Kimi K2.5",
            remainingFraction: 1,
            resetTime: null,
          },
        ],
      },
    ];

    if (usage?.total_tokens !== undefined) {
      logger.info({ usage }, "Kimi account verified with usage data");
    }

    return groups;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function parseApiCallBody(result: ApiCallResponse): unknown {
  if (typeof result.body === "string") {
    try {
      return JSON.parse(result.body);
    } catch {
      return result.body;
    }
  }

  return result.body;
}

function getHeaderValue(
  headers: Record<string, string[] | string> | undefined,
  key: string
): string | null {
  if (!headers) return null;

  const entry = Object.entries(headers).find(
    ([headerKey]) => headerKey.toLowerCase() === key.toLowerCase()
  );

  if (!entry) return null;

  const value = entry[1];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function toFraction(remaining: string | null, limit: string | null): number {
  const remainingNum = remaining ? Number(remaining) : Number.NaN;
  const limitNum = limit ? Number(limit) : Number.NaN;

  if (!Number.isFinite(remainingNum) || !Number.isFinite(limitNum) || limitNum <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, remainingNum / limitNum));
}

async function fetchClaudeQuota(
  authIndex: string
): Promise<QuotaGroup[] | { error: string }> {
  try {
    const usageResponse = await fetch(`${CLIPROXYAPI_MANAGEMENT_URL}/api-call`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MANAGEMENT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_index: authIndex,
        method: "GET",
        url: "https://api.anthropic.com/api/oauth/usage",
        header: {
          Authorization: "Bearer $TOKEN$",
          Accept: "application/json",
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "oauth-2025-04-20",
          "User-Agent": "claude-cli/1.0.83 (external, cli)",
        },
      }),
    });

    if (!usageResponse.ok) {
      return { error: `API call failed: ${usageResponse.status}` };
    }

    const usageResult = (await usageResponse.json()) as ApiCallResponse;
    const usageStatusCode = Number(
      usageResult.status_code ?? usageResult.statusCode ?? 0
    );

    if (usageStatusCode >= 200 && usageStatusCode < 300) {
      const usageBody = parseApiCallBody(usageResult);
      if (typeof usageBody === "object" && usageBody !== null) {
        const usageData = usageBody as ClaudeOAuthUsageResponse;
        const usageGroups: QuotaGroup[] = [];

        const pushUsageGroup = (
          id: string,
          label: string,
          window: ClaudeUsageWindow | undefined
        ) => {
          if (window?.utilization === undefined || window.utilization === null) {
            return;
          }

          const remainingFraction = Math.max(
            0,
            Math.min(1, 1 - window.utilization / 100)
          );

          usageGroups.push({
            id,
            label,
            remainingFraction,
            resetTime: window.resets_at ?? null,
            models: [
              {
                id,
                displayName: label,
                remainingFraction,
                resetTime: window.resets_at ?? null,
              },
            ],
          });
        };

        pushUsageGroup("five-hour", "5h Session", usageData.five_hour);
        pushUsageGroup("seven-day", "7d Weekly", usageData.seven_day);
        pushUsageGroup("seven-day-sonnet", "7d Sonnet", usageData.seven_day_sonnet);
        pushUsageGroup("seven-day-opus", "7d Opus", usageData.seven_day_opus);

        if (
          usageData.extra_usage?.is_enabled &&
          usageData.extra_usage.utilization !== undefined &&
          usageData.extra_usage.utilization !== null
        ) {
          const remainingFraction = Math.max(
            0,
            Math.min(1, 1 - usageData.extra_usage.utilization / 100)
          );

          usageGroups.push({
            id: "extra-usage",
            label: "Extra Usage",
            remainingFraction,
            resetTime: null,
            models: [
              {
                id: "extra-usage",
                displayName: "Extra Usage",
                remainingFraction,
                resetTime: null,
              },
            ],
          });
        }

        if (usageGroups.length > 0) {
          return usageGroups;
        }
      }
    }

    const response = await fetch(`${CLIPROXYAPI_MANAGEMENT_URL}/api-call`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MANAGEMENT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_index: authIndex,
        method: "POST",
        url: "https://api.anthropic.com/v1/messages?beta=true",
        header: {
          Authorization: "Bearer $TOKEN$",
          "anthropic-version": "2023-06-01",
          "anthropic-beta":
            "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14,prompt-caching-2024-07-31",
          "anthropic-dangerous-direct-browser-access": "true",
          "x-app": "cli",
          "x-stainless-helper-method": "stream",
          "x-stainless-retry-count": "0",
          "x-stainless-runtime-version": "v24.3.0",
          "x-stainless-package-version": "0.55.1",
          "x-stainless-runtime": "node",
          "x-stainless-lang": "js",
          "x-stainless-arch": "arm64",
          "x-stainless-os": "MacOS",
          "x-stainless-timeout": "60",
          "User-Agent": "claude-cli/1.0.83 (external, cli)",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 1,
          messages: [{ role: "user", content: "1" }],
        }),
      }),
    });

    if (!response.ok) {
      return { error: `API call failed: ${response.status}` };
    }

    const apiCallResult = (await response.json()) as ApiCallResponse;
    const statusCode = Number(apiCallResult.status_code ?? apiCallResult.statusCode ?? 0);

    if (statusCode < 200 || statusCode >= 300) {
      return { error: `Provider API failed: ${statusCode}` };
    }

    const headers = apiCallResult.header ?? apiCallResult.headers;

    const requestRemaining = getHeaderValue(headers, "anthropic-ratelimit-requests-remaining");
    const requestLimit = getHeaderValue(headers, "anthropic-ratelimit-requests-limit");
    const requestReset = getHeaderValue(headers, "anthropic-ratelimit-requests-reset");

    const inputRemaining = getHeaderValue(headers, "anthropic-ratelimit-input-tokens-remaining");
    const inputLimit = getHeaderValue(headers, "anthropic-ratelimit-input-tokens-limit");
    const inputReset = getHeaderValue(headers, "anthropic-ratelimit-input-tokens-reset");

    const outputRemaining = getHeaderValue(headers, "anthropic-ratelimit-output-tokens-remaining");
    const outputLimit = getHeaderValue(headers, "anthropic-ratelimit-output-tokens-limit");
    const outputReset = getHeaderValue(headers, "anthropic-ratelimit-output-tokens-reset");

    if (!requestLimit && !inputLimit && !outputLimit) {
      return { error: "No Claude quota headers found" };
    }

    const groups: QuotaGroup[] = [
      {
        id: "requests",
        label: "Requests",
        remainingFraction: toFraction(requestRemaining, requestLimit),
        resetTime: requestReset,
        models: [
          {
            id: "requests",
            displayName: "Requests",
            remainingFraction: toFraction(requestRemaining, requestLimit),
            resetTime: requestReset,
          },
        ],
      },
      {
        id: "input-tokens",
        label: "Input Tokens",
        remainingFraction: toFraction(inputRemaining, inputLimit),
        resetTime: inputReset,
        models: [
          {
            id: "input-tokens",
            displayName: "Input Tokens",
            remainingFraction: toFraction(inputRemaining, inputLimit),
            resetTime: inputReset,
          },
        ],
      },
      {
        id: "output-tokens",
        label: "Output Tokens",
        remainingFraction: toFraction(outputRemaining, outputLimit),
        resetTime: outputReset,
        models: [
          {
            id: "output-tokens",
            displayName: "Output Tokens",
            remainingFraction: toFraction(outputRemaining, outputLimit),
            resetTime: outputReset,
          },
        ],
      },
    ].filter((group) => group.remainingFraction > 0 || group.resetTime !== null);

    if (groups.length === 0) {
      return { error: "Claude quota headers unavailable" };
    }

    return groups;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function GET() {
  const session = await verifySession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!MANAGEMENT_API_KEY) {
    logger.error("MANAGEMENT_API_KEY is not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    const authFilesResponse = await fetch(
      `${CLIPROXYAPI_MANAGEMENT_URL}/auth-files`,
      {
        headers: {
          Authorization: `Bearer ${MANAGEMENT_API_KEY}`,
        },
      }
    );

    if (!authFilesResponse.ok) {
      logger.error(
        { status: authFilesResponse.status },
        "Failed to fetch auth files"
      );
      return NextResponse.json(
        { error: "Failed to fetch auth files" },
        { status: 502 }
      );
    }

    const authFilesData =
      (await authFilesResponse.json()) as AuthFilesResponse;

    const activeAccounts = authFilesData.files.filter(
      (file) => !file.disabled && file.status !== "disabled"
    );

    const quotaPromises = activeAccounts.map(async (account) => {
      const authIndex = String(account.auth_index);
      const displayEmail =
        typeof account.email === "string" && account.email.trim() !== ""
          ? account.email.trim()
          : typeof account.label === "string" && account.label.trim() !== ""
            ? account.label.trim()
            : typeof account.name === "string" && account.name.trim() !== ""
              ? account.name.trim()
              : `${account.provider}-${authIndex}`;

      if (account.provider === "claude") {
        const result = await fetchClaudeQuota(authIndex);

        if ("error" in result) {
          const normalizedError = result.error.toLowerCase();
          const needsReauth =
            normalizedError.includes("401") ||
            normalizedError.includes("invalid bearer token") ||
            normalizedError.includes("invalid authorization");

          if (needsReauth) {
            return {
              auth_index: authIndex,
              provider: account.provider,
              email: displayEmail,
              supported: true,
              error: "Claude OAuth token needs re-authentication (provider returned 401)",
            };
          }

          return {
            auth_index: authIndex,
            provider: account.provider,
            email: displayEmail,
            supported: true,
            error: result.error,
          };
        }

        return {
          auth_index: authIndex,
          provider: account.provider,
          email: displayEmail,
          supported: true,
          groups: result,
        };
      }

      if (account.provider === "antigravity") {
        const result = await fetchAntigravityQuota(authIndex);
        
        if ("error" in result) {
          return {
            auth_index: authIndex,
            provider: account.provider,
            email: displayEmail,
            supported: true,
            error: result.error,
          };
        }

        return {
          auth_index: authIndex,
          provider: account.provider,
          email: displayEmail,
          supported: true,
          groups: result,
        };
      }

      if (account.provider === "codex") {
        const result = await fetchCodexQuota(authIndex);
        
        if ("error" in result) {
          return {
            auth_index: authIndex,
            provider: account.provider,
            email: displayEmail,
            supported: true,
            error: result.error,
          };
        }

        return {
          auth_index: authIndex,
          provider: account.provider,
          email: displayEmail,
          supported: true,
          groups: result,
        };
      }

      if (account.provider === "kimi") {
        const result = await fetchKimiQuota(authIndex);

        if ("error" in result) {
          return {
            auth_index: authIndex,
            provider: account.provider,
            email: displayEmail,
            supported: true,
            error: result.error,
          };
        }

        return {
          auth_index: authIndex,
          provider: account.provider,
          email: displayEmail,
          supported: true,
          groups: result,
        };
      }

      return {
        auth_index: authIndex,
        provider: account.provider,
        email: displayEmail,
        supported: false,
      };
    });

    const results = await Promise.allSettled(quotaPromises);

    const accounts: QuotaAccount[] = results.map((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      }

      return {
        auth_index: "unknown",
        provider: "unknown",
        email: "unknown",
        supported: true,
        error: result.reason instanceof Error
          ? result.reason.message
          : "Promise rejected",
      };
    });

    const response: QuotaResponse = { accounts };

    return NextResponse.json(response);
  } catch (error) {
    logger.error({ err: error }, "Quota fetch error");
    return NextResponse.json(
      { error: "Failed to fetch quota data" },
      { status: 502 }
    );
  }
}
