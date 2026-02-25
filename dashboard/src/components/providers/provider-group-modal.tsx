"use client";

import { useState, useEffect } from "react";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

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
        throw new Error(data.error || `Failed to ${isEditing ? "update" : "create"} group`);
      }

      showToast(`Group ${isEditing ? "updated" : "created"} successfully`, "success");
      onSuccess();
      handleClose();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "An error occurred", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <ModalHeader>
        <ModalTitle>{group ? "Edit Provider Group" : "Create Provider Group"}</ModalTitle>
      </ModalHeader>
      
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-6">
            <div>
              <label htmlFor="groupName" className="mb-2 block text-sm font-semibold text-white">
                Group Name <span className="text-red-400">*</span>
              </label>
              <Input
                id="groupName"
                name="groupName"
                value={name}
                onChange={setName}
                placeholder="e.g. Production Models"
                required
                disabled={saving}
              />
            </div>
            
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Color (Optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    disabled={saving}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${selectedColor === color ? "border-white scale-110" : "border-transparent hover:border-white/50"} disabled:opacity-50 disabled:cursor-not-allowed`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
                
                {/* Clear color button */}
                <button 
                  type="button"
                  onClick={() => setSelectedColor(null)} 
                  disabled={saving}
                  className={`w-7 h-7 rounded-full border-2 border-dashed flex items-center justify-center text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${selectedColor === null ? "border-white text-white bg-white/10" : "border-slate-500 text-slate-400 hover:border-white/50"}`}
                  aria-label="No color"
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
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={saving || !name.trim()}
          >
            {saving ? "Saving..." : group ? "Save Changes" : "Create Group"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}