"use client";

export function Toggle({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={`
        relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full
        border-2 border-transparent transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-transparent
        disabled:cursor-not-allowed disabled:opacity-50
        ${enabled ? 'bg-emerald-500' : 'bg-slate-700'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-6 w-6 transform rounded-full
          bg-white shadow-lg ring-0 transition duration-200 ease-in-out
          ${enabled ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  );
}

export function Select({
  value,
  onChange,
  options,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="
        w-full rounded-sm border border-slate-700/70 bg-slate-900/50 px-3 py-2 text-sm
        text-slate-200
        focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors duration-200
      "
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-[#0f172a] text-slate-100">
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-400">{title}</h3>
    </div>
  );
}

export function ConfigField({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="block text-sm font-semibold text-slate-200">{label}</div>
      {description && <p className="text-xs text-slate-500">{description}</p>}
      <div>{children}</div>
    </div>
  );
}
