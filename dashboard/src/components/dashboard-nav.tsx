"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useMobileSidebar } from "@/components/mobile-sidebar-context";

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

const NAV_SECTIONS = [
  { key: "general", label: "General" },
  { key: "access", label: "Access" },
  { key: "admin", label: "Admin" },
] as const;

const NAV_ITEMS = [
  { href: "/dashboard", label: "Quick Start", icon: IconPlayCircle, adminOnly: false, section: "general" },
  { href: "/dashboard/providers", label: "Providers", icon: IconLayers, adminOnly: false, section: "general" },
  { href: "/dashboard/usage", label: "Usage", icon: IconBarChart, adminOnly: false, section: "general" },
  { href: "/dashboard/quota", label: "Quota", icon: IconGauge, adminOnly: false, section: "general" },
  { href: "/dashboard/api-keys", label: "API Keys", icon: IconKey, adminOnly: false, section: "access" },
  { href: "/dashboard/settings", label: "Settings", icon: IconSettings, adminOnly: false, section: "access" },
  { href: "/dashboard/monitoring", label: "Monitoring", icon: IconActivity, adminOnly: true, section: "admin" },
  { href: "/dashboard/containers", label: "Containers", icon: IconBox, adminOnly: true, section: "admin" },
  { href: "/dashboard/config", label: "Config", icon: IconFileCode, adminOnly: true, section: "admin" },
  { href: "/dashboard/admin/users", label: "Users", icon: IconUsers, adminOnly: true, section: "admin" },
  { href: "/dashboard/admin/logs", label: "Logs", icon: IconLogs, adminOnly: true, section: "admin" },
] as const;

export function DashboardNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, isCollapsed, toggleCollapsed, close } = useMobileSidebar();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data.isAdmin ?? false);
        }
      } catch {
        setIsAdmin(false);
      }
    };

    fetchUserInfo();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const handleNavClick = () => {
    close();
  };

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <nav
        className={cn(
          "w-56 glass-nav p-4 flex flex-col lg:transition-[width] lg:duration-200",
          isCollapsed ? "lg:w-[4.5rem]" : "lg:w-56",
          "lg:block",
          "fixed lg:static inset-y-0 left-0 z-50",
          "transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="mb-4">
          <div className={cn("flex", isCollapsed ? "flex-col items-center gap-2" : "items-center justify-between")}> 
            <div className={cn("flex items-center gap-3", isCollapsed && "lg:flex-col lg:gap-1")}> 
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/icon.png" 
              alt="CLIProxy Logo" 
              width={isCollapsed ? 38 : 32}
              height={isCollapsed ? 38 : 32}
              className="rounded-md"
            />
            <div className={cn(isCollapsed && "lg:hidden")}> 
              <h1 className="text-base font-semibold tracking-tight text-slate-100">
                CLIProxy
              </h1>
              <p className="mt-0.5 text-xs text-slate-400">Management</p>
            </div>
            </div>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden rounded-md border border-slate-700/70 bg-slate-800/60 p-1.5 text-slate-300 transition-colors hover:bg-slate-700/70 hover:text-slate-100 lg:inline-flex"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!isCollapsed}
            >
              <svg className={cn("h-4 w-4 transition-transform", isCollapsed && "rotate-180")} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.707 14.707a1 1 0 01-1.414 0L7.293 10.707a1 1 0 010-1.414l4-4a1 1 0 111.414 1.414L9.414 10l3.293 3.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <ul className="space-y-4">
          {NAV_SECTIONS.map((section) => {
            const items = visibleItems.filter((item) => item.section === section.key);
            if (items.length === 0) {
              return null;
            }

            return (
              <li key={section.key} className="space-y-1.5">
                <p className={cn("px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500", isCollapsed && "lg:hidden")}>
                  {section.label}
                </p>
                <ul className="space-y-1">
                  {items.map((item) => {
                    const isActive = pathname === item.href;
                    const IconComponent = item.icon;

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={handleNavClick}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200",
                            isCollapsed && "lg:justify-center lg:px-0",
                            isActive
                              ? "glass-nav-item-active text-slate-100"
                              : "glass-nav-item text-slate-300 hover:text-slate-100"
                          )}
                          title={isCollapsed ? item.label : undefined}
                        >
                          <IconComponent className="h-4 w-4" />
                          <span className={cn(isCollapsed && "lg:hidden")}>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto border-t border-slate-700/80 pt-4">
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              "w-full glass-button-secondary px-3 py-2 text-sm font-medium text-slate-300 rounded-md hover:text-slate-100 transition-colors duration-200",
              isCollapsed && "lg:px-0"
            )}
            title={isCollapsed ? "Logout" : undefined}
          >
            <span className={cn(isCollapsed && "lg:hidden")}>Logout</span>
            <span className={cn("hidden", isCollapsed && "lg:inline")}>⎋</span>
          </button>
        </div>
      </nav>
    </>
  );
}
