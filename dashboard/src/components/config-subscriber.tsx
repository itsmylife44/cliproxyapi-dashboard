"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

interface SubscriptionStatus {
  templateName: string;
  publisherUsername: string;
  publisherId: string;
  isActive: boolean;
  subscribedAt: string;
  lastSyncedAt: string | null;
}

interface ConfigSubscriberProps {
  hasApiKey: boolean;
}

export function ConfigSubscriber({ hasApiKey }: ConfigSubscriberProps) {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareCode, setShareCode] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const { showToast } = useToast();

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/config-sharing/subscribe");
      if (res.status === 404 || res.status === 204) {
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
      if (data === null) {
        setStatus(null);
      } else {
        setStatus(data);
      }
    } catch {
      console.error("Failed to fetch subscription status");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleSubscribe = async () => {
    if (!hasApiKey) {
      showToast("Cannot subscribe without an API key. Please add one first.", "error");
      return;
    }

    if (!shareCode.trim()) {
      showToast("Please enter a share code", "error");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/config-sharing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareCode: shareCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to subscribe", "error");
        return;
      }
      setStatus(data);
      setShareCode("");
      showToast("Successfully subscribed to config", "success");
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
      const res = await fetch("/api/config-sharing/subscribe", {
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
        data.isActive ? "Subscription activated" : "Subscription paused",
        "success"
      );
    } catch {
      showToast("Network error", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!confirm("Are you sure you want to unsubscribe? Your previous config settings will be restored.")) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/config-sharing/subscribe", {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to unsubscribe", "error");
        return;
      }
      setStatus(null);
      showToast("Successfully unsubscribed", "success");
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
              <span className="w-6 h-6 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-sm" aria-hidden="true">
                &#9733;
              </span>
              Subscribe to Shared Config
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
              <span className="w-6 h-6 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-sm" aria-hidden="true">
                &#9733;
              </span>
              Subscribe to Shared Config
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-white/70">
              Subscribe to someone else&apos;s CLIProxyAPI configuration. Your model selection will be
              automatically controlled by the publisher until you unsubscribe.
            </p>

            {!hasApiKey && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-400/30">
                <span className="text-lg">⚠️</span>
                <p className="text-sm text-amber-200/90">
                  You need at least one API key to subscribe. Please add an API key first.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label htmlFor="share-code-input" className="block text-sm font-medium text-white/80 mb-2">
                  Share Code
                </label>
                <Input
                  name="share-code-input"
                  value={shareCode}
                  onChange={setShareCode}
                  placeholder="Enter share code from publisher"
                  disabled={actionLoading || !hasApiKey}
                />
              </div>
              <Button
                onClick={handleSubscribe}
                disabled={actionLoading || !hasApiKey || !shareCode.trim()}
                variant="primary"
                className="w-full"
              >
                {actionLoading ? "Subscribing..." : "Subscribe"}
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
            <span className="w-6 h-6 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-sm" aria-hidden="true">
              &#9733;
            </span>
            Active Subscription
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="backdrop-blur-2xl glass-card rounded-xl p-3 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1">
                Publisher
              </div>
              <div className="text-sm font-semibold text-white">
                {status.publisherUsername}
              </div>
            </div>
            <div className="backdrop-blur-2xl glass-card rounded-xl p-3 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1">
                Template
              </div>
              <div className="text-sm font-semibold text-white">
                {status.templateName}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="backdrop-blur-2xl glass-card rounded-xl p-3 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1">
                Status
              </div>
              <div className={status.isActive ? "text-sm font-semibold text-emerald-400" : "text-sm font-semibold text-amber-400"}>
                {status.isActive ? "Active" : "Paused"}
              </div>
            </div>
            <div className="backdrop-blur-2xl glass-card rounded-xl p-3 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1">
                Last Synced
              </div>
              <div className="text-sm font-semibold text-white">
                {status.lastSyncedAt
                  ? new Date(status.lastSyncedAt).toLocaleString()
                  : "Never"}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-teal-500/10 border border-teal-400/30">
            <span className="text-lg">🔒</span>
            <p className="text-sm text-teal-200/90">
              While subscribed, model selection is controlled by <strong>{status.publisherUsername}</strong>. 
              Your previous preferences will be restored when you unsubscribe.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              onClick={handleToggleActive}
              disabled={actionLoading}
              variant="secondary"
              className="flex-1"
            >
              {actionLoading ? "Updating..." : status.isActive ? "Pause Subscription" : "Activate Subscription"}
            </Button>
            <Button
              onClick={handleUnsubscribe}
              disabled={actionLoading}
              variant="danger"
              className="flex-1"
            >
              {actionLoading ? "Unsubscribing..." : "Unsubscribe"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
