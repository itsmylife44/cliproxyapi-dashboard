"use client";

import { useState, useEffect } from "react";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { extractApiError } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface ProviderGroup {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface ProviderGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group?: ProviderGroup;
  onSuccess: () => void;
}

const PRESET_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

export function ProviderGroupModal({ isOpen, onClose, group, onSuccess }: ProviderGroupModalProps) {
  const { showToast } = useToast();
  const t = useTranslations("providers");
  
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (group) {
        setName(group.name);
        setSelectedColor(group.color);
      } else {
        resetForm();
      }
    }
  }, [isOpen, group]);

  const resetForm = () => {
    setName("");
    setSelectedColor(null);
  };

  const handleClose = () => {
    if (!saving) {
      onClose();
      resetForm();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    
    try {
      const isEditing = !!group;
      const url = isEditing 
        ? `/api/provider-groups/${group.id}` 
        : "/api/provider-groups";
        
      const method = isEditing ? "PATCH" : "POST";
      
      const payload = {
        name: name.trim(),
        color: selectedColor,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(extractApiError(data, `Failed to ${isEditing ? "update" : "create"} group`));
      }

      showToast(isEditing ? t("toastGroupUpdatedSuccess") : t("toastGroupCreatedSuccess"), "success");
      onSuccess();
      onClose();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("errorGroupSave"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <ModalHeader>
        <ModalTitle>{group ? t("providerGroupEditTitle") : t("providerGroupCreateTitle")}</ModalTitle>
      </ModalHeader>
      
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-6">
            <div>
              <label htmlFor="groupName" className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
                {t("providerGroupNameLabel")} <span className="text-red-600">*</span>
              </label>
              <Input
                id="groupName"
                name="groupName"
                value={name}
                onChange={setName}
                placeholder={t("providerGroupNamePlaceholder")}
                required
                disabled={saving}
              />
            </div>
            
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
                {t("providerGroupColorLabel")}
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    disabled={saving}
                    className={`w-7 h-7 rounded-full border-2 transition-[border-color,transform] ${selectedColor === color ? "border-black scale-110" : "border-transparent hover:border-[var(--surface-border)]"} disabled:opacity-50 disabled:cursor-not-allowed`}
                    style={{ backgroundColor: color }}
                    aria-label={t("providerGroupSelectColor", { color })}
                  />
                ))}
                
                {/* Clear color button */}
                <button 
                  type="button"
                  onClick={() => setSelectedColor(null)} 
                  disabled={saving}
                  className={`w-7 h-7 rounded-full border-2 border-dashed flex items-center justify-center text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${selectedColor === null ? "border-black text-[var(--text-primary)] bg-[var(--surface-hover)]" : "border-[var(--surface-border)] text-[var(--text-muted)] hover:border-[var(--surface-border)]"}`}
                  aria-label={t("providerGroupNoColor")}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </ModalContent>
        
        <ModalFooter>
          <Button 
            type="button" 
            variant="ghost" 
            onClick={handleClose} 
            disabled={saving}
          >
            {t("providerGroupCancelButton")}
          </Button>
          <Button 
            type="submit" 
            disabled={saving || !name.trim()}
          >
            {saving ? t("providerGroupSavingButton") : group ? t("providerGroupSaveChanges") : t("providerGroupCreateButton")}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
