"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HeaderEntry {
  _id: number;
  key: string;
  value: string;
}

interface HeadersSectionProps {
  headers: HeaderEntry[];
  saving: boolean;
  onAddHeader: () => void;
  onRemoveHeader: (index: number) => void;
  onUpdateHeader: (index: number, field: "key" | "value", value: string) => void;
}

export function HeadersSection({
  headers,
  saving,
  onAddHeader,
  onRemoveHeader,
  onUpdateHeader,
}: HeadersSectionProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor="headers" className="text-sm font-semibold text-[var(--text-primary)]">Headers (Optional)</label>
        <Button variant="ghost" onClick={onAddHeader} className="px-3 py-1.5 text-xs" disabled={saving}>
          + Add Header
        </Button>
      </div>
      {headers.length > 0 && (
        <div className="space-y-2">
          {headers.map((header, idx) => (
            <div key={header._id} className="flex gap-2">
              <Input
                type="text"
                name={`header-key-${idx}`}
                value={header.key}
                onChange={(val) => onUpdateHeader(idx, "key", val)}
                placeholder="Header-Name"
                disabled={saving}
                className="flex-1"
              />
              <Input
                type="text"
                name={`header-value-${idx}`}
                value={header.value}
                onChange={(val) => onUpdateHeader(idx, "value", val)}
                placeholder="Header-Value"
                disabled={saving}
                className="flex-1"
              />
              <Button variant="danger" onClick={() => onRemoveHeader(idx)} className="px-3 shrink-0" disabled={saving}>
                ✕
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
