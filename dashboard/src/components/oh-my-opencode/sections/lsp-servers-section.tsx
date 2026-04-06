"use client";

import type { OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";

interface LspServersSectionProps {
  overrides: OhMyOpenCodeFullConfig;
  lspLanguage: string;
  lspCommand: string;
  lspExtensions: string;
  onLspLanguageChange: (value: string) => void;
  onLspCommandChange: (value: string) => void;
  onLspExtensionsChange: (value: string) => void;
  onLspAdd: () => void;
  onLspRemove: (language: string) => void;
}

const LSP_PRESETS = [
  { language: "typescript", command: "typescript-language-server --stdio", extensions: ".ts,.tsx", color: "emerald" },
  { language: "tailwindcss", command: "tailwindcss-language-server --stdio", extensions: "", color: "cyan" },
  { language: "prisma", command: "npx -y @prisma/language-server --stdio", extensions: ".prisma", color: "teal" },
  { language: "markdown", command: "npx -y remark-language-server --stdio", extensions: ".md", color: "blue" },
] as const;

const PRESET_BUTTON_STYLES: Record<string, string> = {
  emerald: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300",
  cyan: "bg-[#f5f5f5] border-[#e5e5e5] text-[#4e4e4e] hover:bg-[#eee] hover:border-[#ccc]",
  teal: "bg-[#f5f5f5] border-[#e5e5e5] text-[#4e4e4e] hover:bg-[#eee] hover:border-[#ccc]",
  blue: "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 hover:border-blue-300",
};

export function LspServersSection({
  overrides,
  lspLanguage,
  lspCommand,
  lspExtensions,
  onLspLanguageChange,
  onLspCommandChange,
  onLspExtensionsChange,
  onLspAdd,
  onLspRemove,
}: LspServersSectionProps) {
  const lspEntries = Object.entries(overrides.lsp ?? {});

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            LSP Servers
          </h3>
          <p className="text-xs text-[#777169] mt-1">Configure Language Server Protocol for code intelligence</p>
          <code className="text-[10px] text-emerald-700/70 font-mono block mt-1.5 bg-emerald-100/60 border border-emerald-200/60 px-2 py-1 rounded">
            {`"lsp": { "typescript": { "command": ["typescript-language-server", "--stdio"] } }`}
          </code>
        </div>
        <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono shrink-0">
          {Object.keys(overrides.lsp ?? {}).length} configured
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {LSP_PRESETS.map((preset) => (
          <button
            key={preset.language}
            type="button"
            onClick={() => {
              onLspLanguageChange(preset.language);
              onLspCommandChange(preset.command);
              onLspExtensionsChange(preset.extensions);
            }}
            className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${PRESET_BUTTON_STYLES[preset.color]}`}
          >
            {preset.language.charAt(0).toUpperCase() + preset.language.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr,2fr,1.5fr,auto] gap-2">
        <input
          type="text"
          placeholder="language"
          value={lspLanguage}
          onChange={(e) => onLspLanguageChange(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-[#f5f5f5] border border-[#e5e5e5] rounded-lg text-black placeholder:text-[#aaa] focus:outline-none focus:border-black/20"
        />
        <input
          type="text"
          placeholder="command"
          value={lspCommand}
          onChange={(e) => onLspCommandChange(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-[#f5f5f5] border border-[#e5e5e5] rounded-lg text-black placeholder:text-[#aaa] focus:outline-none focus:border-black/20"
        />
        <input
          type="text"
          placeholder=".ts,.tsx (optional)"
          value={lspExtensions}
          onChange={(e) => onLspExtensionsChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onLspAdd();
            }
          }}
          className="px-2.5 py-1.5 text-xs bg-[#f5f5f5] border border-[#e5e5e5] rounded-lg text-black placeholder:text-[#aaa] focus:outline-none focus:border-black/20"
        />
        <button
          type="button"
          onClick={onLspAdd}
          className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100"
        >
          Add
        </button>
      </div>

      {lspEntries.length > 0 && (
        <div className="space-y-1.5">
          {lspEntries.map(([language, entry]) => (
            <div
              key={language}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200"
            >
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-emerald-700">{language}</span>
                <span className="text-[#aaa]">&rarr;</span>
                <span className="text-[#777169]">{entry.command.join(" ")}</span>
                {entry.extensions && entry.extensions.length > 0 && (
                  <>
                    <span className="text-[#aaa]">|</span>
                    <span className="text-[#777169]">{entry.extensions.join(", ")}</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => onLspRemove(language)}
                className="text-[#999] hover:text-red-600 transition-colors"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
