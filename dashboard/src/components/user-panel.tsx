"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface UserPanelProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  isAdmin: boolean;
}

export function UserPanel({ isOpen, onClose, username, isAdmin }: UserPanelProps) {
  const router = useRouter();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const initial = username ? username.charAt(0).toUpperCase() : "?";

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Reset form state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setPasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  const handlePasswordChange = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Minimum 8 characters required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? data.error ?? "Failed to change password");
        return;
      }

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-panel-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-80 sm:w-96 bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/70 animate-panel-slide overflow-y-auto">
        <div className="flex flex-col h-full p-6">
          {/* Header: Close button */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              {/* Large Avatar */}
              <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-600/50 flex items-center justify-center text-xl font-semibold text-slate-100">
                {initial}
              </div>

              {/* User Info */}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-100">{username}</h2>
                  {isAdmin && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Admin
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">Dashboard Account</p>
              </div>
            </div>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
              aria-label="Close panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Session Info */}
          <div className="mb-6 rounded-md border border-slate-700/50 bg-slate-800/30 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
              <span className="text-xs font-medium text-slate-400">Session active</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 pl-3.5">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-700/50 mb-4" />

          {/* Change Password — Collapsible */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setPasswordOpen(!passwordOpen)}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Change Password
              </div>
              <svg
                className={cn("w-4 h-4 text-slate-500 transition-transform duration-200", passwordOpen && "rotate-180")}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div
              className={cn(
                "overflow-hidden transition-all duration-300 ease-out",
                passwordOpen ? "max-h-96 opacity-100 mt-2" : "max-h-0 opacity-0"
              )}
            >
              <form onSubmit={handlePasswordChange} className="space-y-3 px-3">
                <div>
                  <label htmlFor="panel-current-password" className="mb-1 block text-xs font-medium text-slate-400">
                    Current Password
                  </label>
                  <Input
                    type="password"
                    name="panel-current-password"
                    value={currentPassword}
                    onChange={setCurrentPassword}
                    required
                    autoComplete="current-password"
                  />
                </div>

                <div>
                  <label htmlFor="panel-new-password" className="mb-1 block text-xs font-medium text-slate-400">
                    New Password
                  </label>
                  <Input
                    type="password"
                    name="panel-new-password"
                    value={newPassword}
                    onChange={setNewPassword}
                    required
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                  />
                </div>

                <div>
                  <label htmlFor="panel-confirm-password" className="mb-1 block text-xs font-medium text-slate-400">
                    Confirm New Password
                  </label>
                  <Input
                    type="password"
                    name="panel-confirm-password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    required
                    autoComplete="new-password"
                  />
                </div>

                {/* Feedback */}
                {error && (
                  <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                    Password changed successfully
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Changing..." : "Update Password"}
                </Button>
              </form>
            </div>
          </div>

          {/* Settings Link */}
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/dashboard/settings");
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/50 hover:text-slate-100 transition-colors"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.8 4.8l4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.8-4.8l4.2-4.2" />
            </svg>
            System Settings
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Logout */}
          <div className="border-t border-slate-700/50 pt-4">
            <Button variant="danger" onClick={handleLogout} className="w-full">
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
