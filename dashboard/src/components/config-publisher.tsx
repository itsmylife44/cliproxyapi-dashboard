"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { CopyBlock } from "@/components/copy-block";

interface PublishStatus {
  id: string;
  shareCode: string;
  name: string;
  isActive: boolean;
  subscriberCount: number;
  createdAt: string;
  updatedAt: string;
}

export function ConfigPublisher() {
  const [status, setStatus] = useState<PublishStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [templateName, setTemplateName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const { showToast } = useToast();

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/config-sharing/publish");
      if (res.status === 404) {
        setStatus(null);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setStatus(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setStatus(data);
      setTemplateName(data.name || "");
    } catch {
      console.error("Failed to fetch publish status");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handlePublish = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/config-sharing/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName || "My Config" }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to publish config", "error");
        return;
      }
      setStatus(data);
      setTemplateName(data.name);
      showToast("Config published successfully", "success");
    } catch {
      showToast("Network error", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!status || !templateName.trim()) {
      showToast("Name cannot be empty", "error");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/config-sharing/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to update name", "error");
        return;
      }
      setStatus(data);
      setIsEditing(false);
      showToast("Template name updated", "success");
    } catch {
      showToast("Network error", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async () => {
    if (!status) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/config-sharing/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !status.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to toggle status", "error");
        return;
      }
      setStatus(data);
      showToast(
        data.isActive ? "Template activated" : "Template deactivated",
        "success"
      );
    } catch {
      showToast("Network error", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!confirm("Are you sure you want to unpublish? All subscribers will lose access.")) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/config-sharing/publish", {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to unpublish", "error");
        return;
      }
      setStatus(null);
      setTemplateName("");
      showToast("Config unpublished successfully", "success");
    } catch {
      showToast("Network error", "error");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-sm" aria-hidden="true">
                &#9733;
              </span>
              Share Your Config
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-sm" aria-hidden="true">
                &#9733;
              </span>
              Share Your Config
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-white/70">
              Share your CLIProxyAPI configuration with others. Generate a unique share code that
              others can use to automatically sync with your config settings.
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="template-name" className="block text-sm font-medium text-white/80 mb-2">
                  Template Name (Optional)
                </label>
                <Input
                  name="template-name"
                  value={templateName}
                  onChange={setTemplateName}
                  placeholder="My Config"
                  disabled={actionLoading}
                />
              </div>
              <Button
                onClick={handlePublish}
                disabled={actionLoading}
                variant="primary"
                className="w-full"
              >
                {actionLoading ? "Publishing..." : "Publish Config"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-sm" aria-hidden="true">
              &#9733;
            </span>
            Published Config
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="backdrop-blur-2xl glass-card rounded-xl p-3 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1">
                Status
              </div>
              <div className={status.isActive ? "text-sm font-semibold text-emerald-400" : "text-sm font-semibold text-amber-400"}>
                {status.isActive ? "Active" : "Inactive"}
              </div>
            </div>
            <div className="backdrop-blur-2xl glass-card rounded-xl p-3 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1">
                Subscribers
              </div>
              <div className="text-sm font-semibold text-white">{status.subscriberCount}</div>
            </div>
            <div className="backdrop-blur-2xl glass-card rounded-xl p-3 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1">
                Created
              </div>
              <div className="text-sm font-semibold text-white">
                {new Date(status.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div>
            <div className="block text-sm font-medium text-white/80 mb-2">
              Share Code
            </div>
            <CopyBlock code={status.shareCode} />
            <p className="mt-2 text-xs text-white/50">
              Others can use this code to subscribe to your config updates
            </p>
          </div>

          <div>
            <label htmlFor="edit-template-name" className="block text-sm font-medium text-white/80 mb-2">
              Template Name
            </label>
            {isEditing ? (
              <div className="flex gap-2">
                <Input
                  name="edit-template-name"
                  value={templateName}
                  onChange={setTemplateName}
                  disabled={actionLoading}
                />
                <Button
                  onClick={handleUpdateName}
                  disabled={actionLoading}
                  variant="primary"
                >
                  Save
                </Button>
                <Button
                  onClick={() => {
                    setIsEditing(false);
                    setTemplateName(status.name);
                  }}
                  disabled={actionLoading}
                  variant="ghost"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-4 py-3 text-sm rounded-xl glass-input text-white">
                  {status.name}
                </div>
                <Button
                  onClick={() => setIsEditing(true)}
                  disabled={actionLoading}
                  variant="secondary"
                >
                  Edit
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              onClick={handleToggleActive}
              disabled={actionLoading}
              variant="secondary"
              className="flex-1"
            >
              {actionLoading ? "Updating..." : status.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Button
              onClick={handleUnpublish}
              disabled={actionLoading}
              variant="danger"
              className="flex-1"
            >
              {actionLoading ? "Unpublishing..." : "Unpublish"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
