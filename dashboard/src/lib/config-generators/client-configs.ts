import yaml from "js-yaml";
import type { ModelDefinition } from "./opencode";

export type ClientHarnessId = "opencode" | "omp" | "codex" | "claude" | "kilocode";

export interface ClientHarnessOption {
  id: ClientHarnessId;
  label: string;
}

export const CLIENT_HARNESSES: readonly ClientHarnessOption[] = [
  { id: "opencode", label: "OpenCode" },
  { id: "omp", label: "Oh My Pi" },
  { id: "codex", label: "Codex CLI" },
  { id: "claude", label: "Claude Code" },
  { id: "kilocode", label: "Kilo Code" },
];

export interface GeneratedConfigFile {
  filename: string;
  targetPath: string;
  mimeType: string;
  content: string;
}

export function buildClientConfigFiles({
  harness,
  proxyUrl,
  apiKey,
  availableModels,
  models,
}: {
  harness: Exclude<ClientHarnessId, "opencode">;
  proxyUrl: string;
  apiKey: string;
  availableModels: string[];
  models: Record<string, ModelDefinition>;
}): GeneratedConfigFile[] {
  const baseUrl = proxyUrl.replace(/\/+$/, "");
  if (!apiKey || !availableModels.length) return [];

  switch (harness) {
    case "omp": {
      const modelsDoc = {
        providers: {
          cliproxyapi: {
            baseUrl: `${baseUrl}/v1`,
            api: "openai-completions",
            apiKey,
            authHeader: true,
            discovery: { type: "openai-models-list" },
          },
        },
      };

      const enabledModels = availableModels.map((id) => `cliproxyapi/${id}`);
      const configDoc = { enabledModels, modelRoles: { default: enabledModels[0] } };

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
      ];
    }

    case "codex": {
      const model = availableModels.find((id) => id.startsWith("gpt-")) ?? availableModels[0];
      const tomlLines = [
        `model = ${JSON.stringify(model)}`,
        'model_provider = "cliproxyapi"',
        '',
        '[model_providers.cliproxyapi]',
        'name = "CLIProxyAPI"',
        `base_url = ${JSON.stringify(`${baseUrl}/v1`)}`,
        'wire_api = "responses"',
        'requires_openai_auth = true',
      ];

      const authDoc = {
        auth_mode: "apikey",
        OPENAI_API_KEY: apiKey,
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
        model: availableModels[0],
        env: {
          ANTHROPIC_BASE_URL: baseUrl,
          ANTHROPIC_AUTH_TOKEN: apiKey,
          CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
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
      const config = {
        model: `cliproxyapi/${availableModels[0]}`,
        provider: {
          cliproxyapi: {
            name: "CLIProxyAPI",
            npm: "@ai-sdk/openai-compatible",
            options: { baseURL: `${baseUrl}/v1`, apiKey },
            models: Object.fromEntries(availableModels.map((id) => {
              const model = models[id];
              return [id, model ? { name: model.name, limit: { context: model.context, output: model.output } } : { name: id }];
            })),
          },
        },
      };
      return [
        {
          filename: "kilo.json",
          targetPath: "~/.config/kilo/kilo.json",
          mimeType: "application/json",
          content: JSON.stringify(config, null, 2),
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
