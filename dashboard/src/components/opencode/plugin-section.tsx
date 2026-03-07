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
      <label htmlFor="plugin-input" className="text-xs font-medium text-white/50 uppercase tracking-wider">
        Plugins
      </label>
      <div className="flex gap-2">
        <input
          id="plugin-input"
          type="text"
          value={pluginInput}
          onChange={(e) => onPluginInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAddPlugin()}
          placeholder="plugin-name@version"
          className="flex-1 backdrop-blur-xl bg-white/8 border border-white/15 rounded-lg px-3 py-2 text-sm text-white/90 font-mono placeholder:text-white/30 focus:border-purple-400/50 focus:bg-white/12 focus:outline-none transition-all"
        />
        <button
          type="button"
          onClick={onAddPlugin}
          className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-400/30 text-purple-300 text-sm font-medium hover:bg-purple-500/30 hover:border-purple-400/50 transition-all"
        >
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {plugins.map((plugin) => (
          <span
            key={plugin}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-400/20 text-xs text-purple-300 font-mono"
          >
            {plugin}
            <button
              type="button"
              onClick={() => onRemovePlugin(plugin)}
              className="hover:text-red-400 transition-colors"
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
