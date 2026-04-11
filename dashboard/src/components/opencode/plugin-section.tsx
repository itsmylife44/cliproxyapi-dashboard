"use client";

interface PluginSectionProps {
  plugins: string[];
  pluginInput: string;
  onPluginInputChange: (value: string) => void;
  onAddPlugin: () => void;
  onRemovePlugin: (plugin: string) => void;
}

export function PluginSection({
  plugins,
  pluginInput,
  onPluginInputChange,
  onAddPlugin,
  onRemovePlugin,
}: PluginSectionProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="plugin-input" className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        Plugins
      </label>
      <div className="flex gap-2">
        <input
          id="plugin-input"
          type="text"
          value={pluginInput}
          onChange={(e) => onPluginInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAddPlugin();
            }
          }}
          placeholder="plugin-name@version"
          className="flex-1 bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] font-mono placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]/20 focus:bg-[var(--surface-base)] focus:outline-none transition-colors"
        />
        <button
          type="button"
          onClick={onAddPlugin}
          className="px-4 py-2 rounded-lg bg-[var(--surface-muted)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--surface-hover)] hover:border-[var(--surface-border)] transition-colors"
        >
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {plugins.map((plugin) => (
          <span
            key={plugin}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--surface-muted)] border border-[var(--surface-border)] text-xs text-[var(--text-primary)] font-mono"
          >
            {plugin}
            <button
              type="button"
              onClick={() => onRemovePlugin(plugin)}
              className="hover:text-red-600 transition-colors"
              aria-label={`Remove ${plugin}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <title>Remove</title>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
