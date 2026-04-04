"use client";

interface DisabledMcpsSectionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  disabledMcps: readonly string[];
  mcpInput: string;
  onMcpInputChange: (value: string) => void;
  onMcpAdd: () => void;
  onMcpRemove: (mcp: string) => void;
}

export function DisabledMcpsSection({
  isExpanded,
  onToggleExpand,
  disabledMcps,
  mcpInput,
  onMcpInputChange,
  onMcpAdd,
  onMcpRemove,
}: DisabledMcpsSectionProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-colors hover:border-white/15">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="flex-1 text-left">Disabled MCPs</span>
        <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-white/50 text-[10px] font-mono">
          {disabledMcps.length}
        </span>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="MCP name"
              value={mcpInput}
              onChange={(e) => onMcpInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onMcpAdd();
                }
              }}
              className="flex-1 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400/40"
            />
            <button
              type="button"
              onClick={onMcpAdd}
              className="px-3 py-1.5 text-xs bg-violet-500/20 text-violet-300 rounded-lg hover:bg-violet-500/30"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {disabledMcps.map((mcp) => (
              <div
                key={mcp}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-red-500/10 border border-red-400/20 text-red-300"
              >
                <span className="font-mono">{mcp}</span>
                <button
                  type="button"
                  onClick={() => onMcpRemove(mcp)}
                  className="text-red-400 hover:text-red-200"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
