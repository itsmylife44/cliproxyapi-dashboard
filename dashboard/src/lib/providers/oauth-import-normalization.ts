import "server-only";
import { type OAuthProvider, OAUTH_PROVIDER } from "./constants";

export type NormalizationResult = 
  | { ok: true; normalizedContent: string }
  | { ok: false; error: string };

/**
 * Normalizes OAuth credential JSON from various formats into a consistent structure.
 * Different OAuth providers may export credentials in different formats.
 * This function attempts to parse and validate the content.
 */
export function normalizeImportedOAuthCredential(
  provider: OAuthProvider,
  fileContent: string
): NormalizationResult {
  let parsedContent: unknown;

  try {
    parsedContent = JSON.parse(fileContent);
  } catch {
    return { ok: false, error: "Invalid JSON content" };
  }

  if (!parsedContent || typeof parsedContent !== "object" || Array.isArray(parsedContent)) {
    return { ok: false, error: "Credential file must contain a JSON object, not an array" };
  }

  const content = parsedContent as Record<string, unknown>;

  // Provider-specific normalization
  switch (provider) {
    case OAUTH_PROVIDER.CLAUDE:
      return normalizeClaudeCredential(content);
    case OAUTH_PROVIDER.GEMINI_CLI:
      return normalizeGeminiCredential(content);
    case OAUTH_PROVIDER.CODEX:
      return normalizeCodexCredential(content);
    case OAUTH_PROVIDER.COPILOT:
      return normalizeCopilotCredential(content);
    case OAUTH_PROVIDER.CURSOR:
      return normalizeCursorCredential(content);
    default:
      // For other providers, just validate basic structure and pass through
      return normalizeGenericCredential(content);
  }
}

function normalizeClaudeCredential(content: Record<string, unknown>): NormalizationResult {
  // Claude credentials typically have refresh_token and may have accessToken or access_token
  if (!content.refresh_token && !content.refreshToken) {
    // Check for alternate structures
    if (content.claudeAiOauth && typeof content.claudeAiOauth === "object") {
      const oauth = content.claudeAiOauth as Record<string, unknown>;
      if (oauth.refreshToken || oauth.refresh_token) {
        return { ok: true, normalizedContent: JSON.stringify(content) };
      }
    }
    return { ok: false, error: "Claude credential must contain refresh_token" };
  }
  return { ok: true, normalizedContent: JSON.stringify(content) };
}

function normalizeGeminiCredential(content: Record<string, unknown>): NormalizationResult {
  // Gemini CLI credentials
  if (!content.refresh_token && !content.refreshToken) {
    return { ok: false, error: "Gemini credential must contain refresh_token" };
  }
  return { ok: true, normalizedContent: JSON.stringify(content) };
}

function normalizeCodexCredential(content: Record<string, unknown>): NormalizationResult {
  // Codex/OpenAI credentials
  if (!content.refresh_token && !content.api_key && !content.accessToken) {
    return { ok: false, error: "Codex credential must contain refresh_token, api_key, or accessToken" };
  }
  return { ok: true, normalizedContent: JSON.stringify(content) };
}

function normalizeCopilotCredential(content: Record<string, unknown>): NormalizationResult {
  // GitHub Copilot credentials
  if (!content.oauth_token && !content.token && !content.access_token) {
    return { ok: false, error: "Copilot credential must contain oauth_token, token, or access_token" };
  }
  return { ok: true, normalizedContent: JSON.stringify(content) };
}

function normalizeCursorCredential(content: Record<string, unknown>): NormalizationResult {
  // Cursor credentials
  if (!content.accessToken && !content.access_token && !content.refreshToken && !content.refresh_token) {
    return { ok: false, error: "Cursor credential must contain accessToken or refreshToken" };
  }
  return { ok: true, normalizedContent: JSON.stringify(content) };
}

function normalizeGenericCredential(content: Record<string, unknown>): NormalizationResult {
  // For unknown providers, validate there's at least some token-like field
  const hasToken = Object.keys(content).some(key => 
    key.toLowerCase().includes("token") || 
    key.toLowerCase().includes("key") ||
    key.toLowerCase().includes("secret") ||
    key.toLowerCase().includes("credential")
  );

  if (!hasToken && Object.keys(content).length === 0) {
    return { ok: false, error: "Credential file appears to be empty or invalid" };
  }

  return { ok: true, normalizedContent: JSON.stringify(content) };
}
