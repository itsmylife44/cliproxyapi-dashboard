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

const NAV_ITEMS = [
  { href: "/dashboard", label: "Quick Start", icon: IconPlayCircle, adminOnly: false },
  { href: "/dashboard/monitoring", label: "Monitoring", icon: IconActivity, adminOnly: true },
  { href: "/dashboard/containers", label: "Containers", icon: IconBox, adminOnly: true },
  { href: "/dashboard/config", label: "Config", icon: IconFileCode, adminOnly: true },
  { href: "/dashboard/api-keys", label: "API Keys", icon: IconKey, adminOnly: false },
  { href: "/dashboard/providers", label: "Providers", icon: IconLayers, adminOnly: false },
  { href: "/dashboard/usage", label: "Usage", icon: IconBarChart, adminOnly: true },
  { href: "/dashboard/quota", label: "Quota", icon: IconGauge, adminOnly: false },
  { href: "/dashboard/admin/users", label: "Users", icon: IconUsers, adminOnly: true },
  { href: "/dashboard/settings", label: "Settings", icon: IconSettings, adminOnly: false },
] as const;

export function DashboardNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, close } = useMobileSidebar();
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
          "w-64 glass-nav p-6 flex flex-col",
          "lg:block",
          "fixed lg:static inset-y-0 left-0 z-50",
          "transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="mb-8">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/icon.png" 
              alt="CLIProxy Logo" 
              width={32} 
              height={32}
              className="rounded-lg"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                CLIProxy
              </h1>
              <p className="mt-0.5 text-xs text-white/70">Management</p>
            </div>
          </div>
        </div>

        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            if (item.adminOnly && !isAdmin) {
              return null;
            }
            
            const isActive = pathname === item.href;
            const IconComponent = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300",
                    isActive
                      ? "glass-nav-item-active text-white"
                      : "glass-nav-item text-white/70 hover:text-white/90"
                  )}
                >
                  <IconComponent className="w-5 h-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full glass-button-secondary px-4 py-3 text-sm font-medium text-white/70 rounded-xl hover:text-white transition-all duration-200"
          >
            Logout
          </button>
        </div>
      </nav>
    </>
  );
}
