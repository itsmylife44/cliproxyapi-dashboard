import yaml from "js-yaml";

export type ClientHarnessId = "opencode" | "omp" | "codex" | "claude" | "kilocode";

export interface ClientHarnessOption {
  id: ClientHarnessId;
  label: string;
  subtitle: string;
}

export const CLIENT_HARNESSES: readonly ClientHarnessOption[] = [
  { id: "opencode", label: "OpenCode", subtitle: "opencode.json + Oh My OpenAgent / Slim" },
  { id: "omp", label: "Oh My Pi (omp)", subtitle: "~/.omp/agent/ (models.yml, config.yml, keybindings.json)" },
  { id: "codex", label: "Codex CLI", subtitle: "~/.codex/ (config.toml, auth.json)" },
  { id: "claude", label: "Claude Code", subtitle: "~/.claude/settings.json" },
  { id: "kilocode", label: "KiloCode", subtitle: "~/.local/share/kilo/auth.json" },
] as const;

export interface GeneratedConfigFile {
  filename: string;
  targetPath: string;
  mimeType: string;
  content: string;
}

function normalizeProxyBase(proxyUrl: string): string {
  return proxyUrl.replace(/\/+$/, "");
}

function pickModel(
  models: string[],
  preferences: string[],
  fallback: string,
): string {
  for (const pref of preferences) {
    const exact = models.find((m) => m.toLowerCase() === pref.toLowerCase());
    if (exact) return exact;
  }
  for (const pref of preferences) {
    const partial = models.find((m) => m.toLowerCase().includes(pref.toLowerCase()));
    if (partial) return partial;
  }
  return models[0] ?? fallback;
}

export function buildClientConfigFiles({
  harness,
  proxyUrl,
  apiKey,
  availableModels,
}: {
  harness: Exclude<ClientHarnessId, "opencode">;
  proxyUrl: string;
  apiKey: string;
  availableModels: string[];
}): GeneratedConfigFile[] {
  const baseUrl = normalizeProxyBase(proxyUrl);
  const key = apiKey || "your-api-key-from-dashboard";

  switch (harness) {
    case "omp": {
      const modelsDoc = {
        providers: {
          cliproxyapi: {
            baseUrl: `${baseUrl}/v1`,
            api: "openai-completions",
            apiKey: key,
            authHeader: true,
            discovery: { type: "openai-models-list" },
            compat: {
              supportsReasoningEffort: true,
              omitReasoningEffort: false,
            },
          },
          "openai-codex": {
            baseUrl: `${baseUrl}/v1`,
            api: "openai-codex-responses",
            apiKey: key,
          },
        },
      };

      const defaultMain = pickModel(availableModels, ["gpt-6.1-terra", "gpt-5.4", "claude-sonnet-4-6", "gemini-2.5-pro"], "gpt-5.4");
      const defaultFast = pickModel(availableModels, ["gpt-6-luna", "gemini-2.5-flash", "claude-haiku-4-5"], defaultMain);
      const defaultDesigner = pickModel(availableModels, ["claude-opus-5", "claude-opus-4-6", "claude-sonnet-4-6"], defaultMain);
      const defaultWeb = pickModel(availableModels, ["gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.4"], defaultMain);

      const configDoc = {
        modelRoles: {
          smol: `cliproxyapi/${defaultMain}:minimal`,
          slow: `cliproxyapi/${defaultMain}:medium`,
          designer: `cliproxyapi/${defaultDesigner}`,
          web: `openai-codex/${defaultWeb}`,
          tiny: `cliproxyapi/${defaultFast}`,
          task: `cliproxyapi/${defaultMain}:auto`,
          advisor: `cliproxyapi/${defaultMain}:minimal`,
          default: `cliproxyapi/${defaultMain}`,
        },
        steeringMode: "all",
        followUpMode: "all",
        interruptMode: "wait",
        symbolPreset: "unicode",
        composer: { shape: "claude" },
        theme: { dark: "titanium", light: "light" },
        statusLine: { preset: "nerd", compactThinkingLevel: false },
        display: { showTokenUsage: true },
        tools: { approvalMode: "yolo" },
        compaction: {
          thresholdPercent: -1,
          thresholdTokens: 270000,
          idleEnabled: true,
          idleThresholdTokens: 270000,
          experimentalContextManagement: true,
        },
        defaultThinkingLevel: "auto",
        hideThinkingBlock: false,
        providers: { webSearchOrder: ["codex"] },
        task: {
          agentModelOverrides: {
            reviewer: `cliproxyapi/${defaultMain}`,
          },
        },
      };

      const keybindingsDoc = {
        "app.message.followUp": ["Tab", "Ctrl+Enter", "Ctrl+Q"],
        "app.model.selectTemporary": ["Alt+M", "Alt+P"],
        "app.model.select": "Ctrl+Alt+M",
      };

      return [
        {
          filename: "models.yml",
          targetPath: "~/.omp/agent/models.yml",
          mimeType: "text/yaml",
          content: yaml.dump(modelsDoc, { lineWidth: -1, noRefs: true }),
        },
        {
          filename: "config.yml",
          targetPath: "~/.omp/agent/config.yml",
          mimeType: "text/yaml",
          content: yaml.dump(configDoc, { lineWidth: -1, noRefs: true }),
        },
        {
          filename: "keybindings.json",
          targetPath: "~/.omp/agent/keybindings.json",
          mimeType: "application/json",
          content: JSON.stringify(keybindingsDoc, null, 2),
        },
      ];
    }

    case "codex": {
      const hasGpt = availableModels.some((m) => m.toLowerCase().startsWith("gpt-"));
      const tomlLines = [
        "[model_providers.cliproxyapi]",
        'name = "CLIProxyAPI"',
        `base_url = "${baseUrl}/v1"`,
        'wire_api = "responses"',
        "requires_openai_auth = true",
      ];
      if (hasGpt) {
        tomlLines.push("supports_standalone_web_search = true");
      }

      const authDoc = {
        auth_mode: "apikey",
        OPENAI_API_KEY: key,
      };

      return [
        {
          filename: "config.toml",
          targetPath: "~/.codex/config.toml",
          mimeType: "application/toml",
          content: `${tomlLines.join("\n")}\n`,
        },
        {
          filename: "auth.json",
          targetPath: "~/.codex/auth.json",
          mimeType: "application/json",
          content: JSON.stringify(authDoc, null, 2),
        },
      ];
    }

    case "claude": {
      const settingsDoc = {
        env: {
          ANTHROPIC_BASE_URL: baseUrl,
          ANTHROPIC_AUTH_TOKEN: key,
          CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
        },
        permissions: {
          defaultMode: "bypassPermissions",
        },
      };

      return [
        {
          filename: "settings.json",
          targetPath: "~/.claude/settings.json",
          mimeType: "application/json",
          content: JSON.stringify(settingsDoc, null, 2),
        },
      ];
    }

    case "kilocode": {
      const authDoc = {
        cliproxyapi: {
          type: "api",
          key,
        },
      };

      return [
        {
          filename: "auth.json",
          targetPath: "~/.local/share/kilo/auth.json",
          mimeType: "application/json",
          content: JSON.stringify(authDoc, null, 2),
        },
      ];
    }
  }
}

export function downloadTextFile(content: string, filename: string, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
