"use client";

import { useTranslations } from "next-intl";

interface GroupOption {
  id: string;
  name: string;
  color: string | null;
}

interface GroupSelectProps {
  groupId: string | null;
  groups: GroupOption[];
  saving: boolean;
  onGroupIdChange: (value: string | null) => void;
}

export function GroupSelect({
  groupId,
  groups,
  saving,
  onGroupIdChange,
}: GroupSelectProps) {
  const t = useTranslations("providers");

  return (
    <div>
      <label htmlFor="group-select" className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
        {t("groupLabel")}
      </label>
      <select
        id="group-select"
        value={groupId ?? ""}
        onChange={(e) => onGroupIdChange(e.target.value || null)}
        disabled={saving}
        className="w-full px-3 py-2 text-sm rounded-md glass-input text-[var(--text-primary)] focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 bg-[var(--surface-base)] border border-[var(--surface-border)]"
      >
        <option value="" className="bg-[var(--surface-base)] text-[var(--text-primary)]">{t("groupNoOption")}</option>
        {groups.map(g => (
          <option key={g.id} value={g.id} className="bg-[var(--surface-base)] text-[var(--text-primary)]">{g.name}</option>
        ))}
      </select>
      <p className="mt-1.5 text-xs text-[var(--text-muted)]">{t("groupHint")}</p>
    </div>
  );
}
