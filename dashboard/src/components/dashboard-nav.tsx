"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useMobileSidebar } from "@/components/mobile-sidebar-context";
import { useAuth } from "@/hooks/use-auth";
import { useFocusTrap } from "@/hooks/use-focus-trap";

function IconPlayCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  );
}

function IconActivity({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconBox({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function IconFileCode({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <polyline points="10 13 7 16 10 19" />
      <polyline points="14 13 17 16 14 19" />
    </svg>
  );
}

function IconKey({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function IconLayers({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconBarChart({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}

function IconGauge({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.8 4.8l4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.8-4.8l4.2-4.2" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconLogs({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={cn("h-4 w-4 shrink-0 transition-transform duration-300", collapsed && "rotate-180")}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path fillRule="evenodd" d="M12.707 14.707a1 1 0 01-1.414 0L7.293 10.707a1 1 0 010-1.414l4-4a1 1 0 111.414 1.414L9.414 10l3.293 3.293a1 1 0 010 1.414z" clipRule="evenodd" />
    </svg>
  );
}

const NAV_SECTIONS = [
  { key: "general", labelKey: "sectionGeneral" },
  { key: "access", labelKey: "sectionAccess" },
  { key: "admin", labelKey: "sectionAdmin" },
] as const;

const NAV_ITEMS = [
  { href: "/dashboard", labelKey: "quickStart", icon: IconPlayCircle, adminOnly: false, section: "general" },
  { href: "/dashboard/providers", labelKey: "providers", icon: IconLayers, adminOnly: false, section: "general" },
  { href: "/dashboard/usage", labelKey: "usage", icon: IconBarChart, adminOnly: false, section: "general" },
  { href: "/dashboard/quota", labelKey: "quota", icon: IconGauge, adminOnly: false, section: "general" },
  { href: "/dashboard/api-keys", labelKey: "apiKeys", icon: IconKey, adminOnly: false, section: "access" },
  { href: "/dashboard/settings", labelKey: "settings", icon: IconSettings, adminOnly: false, section: "access" },
  { href: "/dashboard/monitoring", labelKey: "monitoring", icon: IconActivity, adminOnly: true, section: "admin" },
  { href: "/dashboard/containers", labelKey: "containers", icon: IconBox, adminOnly: true, section: "admin" },
  { href: "/dashboard/config", labelKey: "config", icon: IconFileCode, adminOnly: true, section: "admin" },
  { href: "/dashboard/admin/users", labelKey: "users", icon: IconUsers, adminOnly: true, section: "admin" },
  { href: "/dashboard/admin/logs", labelKey: "logs", icon: IconLogs, adminOnly: true, section: "admin" },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  const { isOpen, isCollapsed, toggleCollapsed, close } = useMobileSidebar();
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const t = useTranslations("nav");
  const navRef = useRef<HTMLElement>(null);

  useFocusTrap(isOpen, navRef as React.RefObject<HTMLElement | null>);

  const handleNavClick = () => {
    close();
  };

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, close]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <nav
        ref={navRef}
        role={isOpen ? "dialog" : undefined}
        aria-modal={isOpen ? "true" : undefined}
        aria-label={t("navigationAriaLabel")}
        className={cn(
          "glass-nav flex flex-col overflow-hidden",
          "lg:transition-[width] lg:duration-300 lg:ease-in-out",
          isCollapsed ? "lg:w-16" : "lg:w-56",
          "w-56 lg:block",
          "fixed lg:static inset-y-0 left-0 z-50",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4">
          <Image
            src="/icon.png"
            alt="CLIProxy Logo"
            width={32}
            height={32}
            className="shrink-0 rounded-md"
          />
          <div className={cn("min-w-0 transition-opacity duration-200", isCollapsed && "lg:opacity-0")}>
            <h1 className="truncate text-base font-semibold tracking-tight text-[var(--text-primary)]">
              CLIProxy
            </h1>
            <p className="truncate text-xs text-[var(--text-muted)]">Management</p>
          </div>
        </div>

        {/* Nav items */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
          <ul className="space-y-4">
            {NAV_SECTIONS.map((section) => {
              const items = visibleItems.filter((item) => item.section === section.key);
              if (items.length === 0) return null;

              return (
                <li key={section.key} className="space-y-1">
                  <p className={cn(
                    "px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] truncate transition-opacity duration-200",
                    isCollapsed && "lg:opacity-0"
                  )}>
                    {section.label}
                  </p>
                  <ul className="space-y-0.5">
                    {items.map((item) => {
                      const isActive = pathname === item.href;
                      const IconComponent = item.icon;

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={handleNavClick}
                            className={cn(
                              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                              isActive
                                ? "glass-nav-item-active text-[var(--text-primary)]"
                                : "glass-nav-item text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            )}
                            title={isCollapsed ? item.label : undefined}
                          >
                            <IconComponent className="h-4 w-4 shrink-0" />
                            <span className={cn("truncate transition-opacity duration-200", isCollapsed && "lg:opacity-0")}>
                              {item.label}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Collapse toggle — pinned to bottom */}
        <div className="hidden border-t border-[var(--surface-border)] px-2 py-2 lg:block">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex w-full items-center rounded-md px-3 py-2 text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!isCollapsed}
          >
            <CollapseIcon collapsed={isCollapsed} />
          </button>
        </div>
      </nav>
    </>
  );
}
