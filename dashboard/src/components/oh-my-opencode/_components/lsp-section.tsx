"use client";

import { useState } from "react";
import type { OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";

const LSP_PRESETS = [
  { language: "typescript", command: "typescript-language-server --stdio", extensions: ".ts,.tsx", color: "emerald" },
  { language: "tailwindcss", command: "tailwindcss-language-server --stdio", extensions: "", color: "cyan" },
  { language: "prisma", command: "npx -y @prisma/language-server --stdio", extensions: ".prisma", color: "teal" },
  { language: "markdown", command: "npx -y remark-language-server --stdio", extensions: ".md", color: "blue" },
] as const;

const PRESET_CLASSES: Record<string, string> = {
  emerald: "bg-emerald-500/10 border-emerald-400/20 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/40",
  cyan: "bg-cyan-500/10 border-cyan-400/20 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400/40",
  teal: "bg-teal-500/10 border-teal-400/20 text-teal-300 hover:bg-teal-500/20 hover:border-teal-400/40",
  blue: "bg-blue-500/10 border-blue-400/20 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400/40",
};

interface LspSectionProps {
  overrides: OhMyOpenCodeFullConfig;
  onLspAdd: (language: string, command: string, extensions: string) => boolean;
  onLspRemove: (language: string) => void;
}

export function LspSection({ overrides, onLspAdd, onLspRemove }: LspSectionProps) {
  const [lspLanguage, setLspLanguage] = useState("");
  const [lspCommand, setLspCommand] = useState("");
  const [lspExtensions, setLspExtensions] = useState("");

  const handleLspAdd = () => {
    const shouldClear = onLspAdd(lspLanguage, lspCommand, lspExtensions);
    if (shouldClear) {
      setLspLanguage("");
      setLspCommand("");
      setLspExtensions("");
    }
  };

  return (
    <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
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
          <p className="text-xs text-white/50 mt-1">Configure Language Server Protocol for code intelligence</p>
          <code className="text-[10px] text-emerald-300/60 font-mono block mt-1.5 bg-black/20 px-2 py-1 rounded">
            {`"lsp": { "typescript": { "command": ["typescript-language-server", "--stdio"] } }`}
          </code>
        </div>
        <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-xs font-mono shrink-0">
          {Object.keys(overrides.lsp ?? {}).length} configured
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {LSP_PRESETS.map((preset) => (
          <button
            key={preset.language}
            type="button"
            onClick={() => {
              setLspLanguage(preset.language);
              setLspCommand(preset.command);
              setLspExtensions(preset.extensions);
            }}
            className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${PRESET_CLASSES[preset.color]}`}
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
          onChange={(e) => setLspLanguage(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400/40"
        />
        <input
          type="text"
          placeholder="command"
          value={lspCommand}
          onChange={(e) => setLspCommand(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400/40"
        />
        <input
          type="text"
          placeholder=".ts,.tsx (optional)"
          value={lspExtensions}
          onChange={(e) => setLspExtensions(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleLspAdd();
            }
          }}
          className="px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400/40"
        />
        <button
          type="button"
          onClick={handleLspAdd}
          className="px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30"
        >
          Add
        </button>
      </div>

      {Object.keys(overrides.lsp ?? {}).length > 0 && (
        <div className="space-y-1.5">
          {Object.entries(overrides.lsp ?? {}).map(([language, entry]) => (
            <div
              key={language}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-400/20"
            >
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-emerald-300">{language}</span>
                <span className="text-white/30">&rarr;</span>
                <span className="text-white/60">{entry.command.join(" ")}</span>
                {entry.extensions && entry.extensions.length > 0 && (
                  <>
                    <span className="text-white/30">|</span>
                    <span className="text-white/50">{entry.extensions.join(", ")}</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => onLspRemove(language)}
                className="text-white/40 hover:text-red-400 transition-colors"
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
