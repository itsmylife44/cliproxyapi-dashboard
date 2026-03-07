"use client";

interface ToggleListSectionProps {
  label: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  items: readonly string[];
  disabledItems: readonly string[];
  onItemToggle: (item: string) => void;
}

export function ToggleListSection({
  label,
  isExpanded,
  onToggleExpand,
  items,
  disabledItems,
  onItemToggle,
}: ToggleListSectionProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
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
        <span className="flex-1 text-left">{label}</span>
        <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-white/50 text-[10px] font-mono">
          {disabledItems.length} disabled
        </span>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 space-y-1">
          {items.map((item) => {
            const isEnabled = !disabledItems.includes(item);
            return (
              <div key={item} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                <span className="text-xs text-white/70 font-mono">{item}</span>
                <button
                  type="button"
                  onClick={() => onItemToggle(item)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${
                    isEnabled ? "bg-emerald-500/60" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                      isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
