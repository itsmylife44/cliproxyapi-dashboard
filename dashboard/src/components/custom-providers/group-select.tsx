"use client";

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
  return (
    <div>
      <label htmlFor="group-select" className="mb-2 block text-sm font-semibold text-white">
        Group (Optional)
      </label>
      <select
        id="group-select"
        value={groupId ?? ""}
        onChange={(e) => onGroupIdChange(e.target.value || null)}
        disabled={saving}
        className="w-full px-3 py-2 text-sm rounded-md glass-input text-white focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 bg-slate-900 border border-slate-700/70"
      >
        <option value="" className="bg-slate-900 text-white">No group</option>
        {groups.map(g => (
          <option key={g.id} value={g.id} className="bg-slate-900 text-white">{g.name}</option>
        ))}
      </select>
      <p className="mt-1.5 text-xs text-white/50">Assign this provider to a group for organization</p>
    </div>
  );
}
