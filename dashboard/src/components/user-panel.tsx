"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { useFocusTrap } from "@/hooks/use-focus-trap";

interface UserPanelProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  isAdmin: boolean;
}

export function UserPanel({ isOpen, onClose, username, isAdmin }: UserPanelProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useFocusTrap(isOpen, panelRef);

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
      const res = await fetch(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
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
    await fetch(API_ENDPOINTS.AUTH.LOGOUT, { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/20 animate-panel-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="User settings"
        className="fixed inset-y-0 right-0 z-50 w-80 sm:w-96 bg-white border-l border-[#e5e5e5] animate-panel-slide overflow-y-auto"
        style={{ overscrollBehavior: "contain" }}
      >
        <div className="flex flex-col h-full p-6">
          {/* Header: Close button */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              {/* Large Avatar */}
              <div className="w-14 h-14 rounded-full bg-[#f5f5f5] border border-[#e5e5e5] flex items-center justify-center text-xl font-semibold text-black">
                {initial}
              </div>

              {/* User Info */}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-black">{username}</h2>
                  {isAdmin && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-[#f5f5f5] text-[#4e4e4e] border border-[#e5e5e5]">
                      Admin
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-[#777169]">Dashboard Account</p>
              </div>
            </div>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-[#777169] hover:text-black hover:bg-[#f5f5f5] transition-colors"
              aria-label="Close panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Session Info */}
          <div className="mb-6 rounded-md border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
              <span className="text-xs font-medium text-[#777169]">Session active</span>
            </div>
            <p className="mt-1 text-xs text-[#777169] pl-3.5">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-[#e5e5e5] mb-4" />

          {/* Change Password — Collapsible */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setPasswordOpen(!passwordOpen)}
              aria-expanded={passwordOpen}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold text-black hover:bg-[#f5f5f5] transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#777169]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Change Password
              </div>
              <svg
                className={cn("w-4 h-4 text-[#777169] transition-transform duration-200", passwordOpen && "rotate-180")}
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
                "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
                passwordOpen ? "max-h-96 opacity-100 mt-2" : "max-h-0 opacity-0"
              )}
            >
              <form onSubmit={handlePasswordChange} className="space-y-3 px-3">
                <div>
                  <label htmlFor="panel-current-password" className="mb-1 block text-xs font-medium text-[#777169]">
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
                  <label htmlFor="panel-new-password" className="mb-1 block text-xs font-medium text-[#777169]">
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
                  <label htmlFor="panel-confirm-password" className="mb-1 block text-xs font-medium text-[#777169]">
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
                  <div role="alert" aria-live="polite" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    {error}
                  </div>
                )}

                {success && (
                  <div role="status" aria-live="polite" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                    Password changed successfully
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Changing\u2026" : "Update Password"}
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
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[#4e4e4e] hover:bg-[#f5f5f5] hover:text-black transition-colors"
          >
            <svg className="w-4 h-4 text-[#777169]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.8 4.8l4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.8-4.8l4.2-4.2" />
            </svg>
            System Settings
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Logout */}
          <div className="border-t border-[#e5e5e5] pt-4">
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
