"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Notification, NotificationType } from "@/hooks/use-header-notifications";

interface NotificationBellProps {
  notifications: Notification[];
  criticalCount: number;
  totalCount: number;
  onDismiss: (id: string) => void;
}

function BellIcon({ hasNotifications }: { hasNotifications: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-[18px] h-[18px] ${hasNotifications ? "text-black" : "text-[#777169]"}`}
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

const TYPE_STYLES: Record<NotificationType, { dot: string; border: string; bg: string }> = {
  critical: { dot: "bg-red-500", border: "border-red-500/30", bg: "bg-red-500/5" },
  warning: { dot: "bg-amber-500", border: "border-amber-200", bg: "bg-amber-500/5" },
  info: { dot: "bg-blue-500", border: "border-blue-200", bg: "bg-blue-500/5" },
};

function NotificationItem({ notification, onNavigate, onDismiss }: { notification: Notification; onNavigate: () => void; onDismiss: (id: string) => void }) {
  const style = TYPE_STYLES[notification.type];
  const handleClick = () => {
    onDismiss(notification.id);
    onNavigate();
  };
  const content = (
    <div className={`flex items-start gap-2.5 rounded-md border ${style.border} ${style.bg} px-3 py-2.5 transition-colors hover:brightness-125`}>
      <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${style.dot}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-black">{notification.title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[#777169]">{notification.message}</p>
      </div>
    </div>
  );

  if (notification.link) {
    return <Link href={notification.link} onClick={handleClick}>{content}</Link>;
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}
      style={{ cursor: "pointer" }}
    >
      {content}
    </div>
  );
}

interface DropdownPosition {
  top: number;
  right: number;
}

function NotificationDropdown({
  notifications,
  totalCount,
  position,
  onClose,
  onDismiss,
}: {
  notifications: Notification[];
  totalCount: number;
  position: DropdownPosition;
  onClose: () => void;
  onDismiss: (id: string) => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    // Delay listener to avoid closing on the same click that opened
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    document.addEventListener("keydown", handleEscape);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={dropdownRef}
      role="menu"
      aria-label="Notifications"
      className="fixed z-[9999] w-80 overflow-hidden rounded-lg border border-[#e5e5e5] bg-white shadow-[rgba(0,0,0,0.06)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_4px_8px]"
      style={{ top: position.top, right: position.right }}
    >
      <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#777169]">
          Notifications
        </h3>
        {totalCount > 0 && (
          <span className="text-[11px] tabular-nums text-[#777169]">{totalCount}</span>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-[#777169]">
              <BellIcon hasNotifications={false} />
            </div>
            <p className="mt-2 text-xs text-[#777169]">All clear — no notifications</p>
          </div>
        ) : (
          <div className="space-y-1.5 p-2">
            {notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onNavigate={onClose} onDismiss={onDismiss} />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function NotificationBell({ notifications, criticalCount, totalCount, onDismiss }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<DropdownPosition>({ top: 0, right: 0 });

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  const handleClose = useCallback(() => setOpen(false), []);

  const badgeColor = criticalCount > 0 ? "bg-red-500" : "bg-amber-500";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          updatePosition();
          setOpen((prev) => !prev);
        }}
        aria-label={`Notifications${totalCount > 0 ? ` (${totalCount})` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e5e5] bg-[#f5f5f5] transition-colors hover:border-[rgba(0,0,0,0.15)] hover:bg-[#f5f5f5]"
      >
        <BellIcon hasNotifications={totalCount > 0} />
        {totalCount > 0 && (
          <span className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full ${badgeColor} px-1 text-[10px] font-bold text-white shadow-sm`}>
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown
          notifications={notifications}
          totalCount={totalCount}
          position={position}
          onClose={handleClose}
          onDismiss={onDismiss}
        />
      )}
    </>
  );
}
