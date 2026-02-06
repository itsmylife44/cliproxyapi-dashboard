"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMobileSidebar } from "@/components/mobile-sidebar-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Quick Start", icon: "▸" },
  { href: "/dashboard/monitoring", label: "Monitoring", icon: "◉" },
  { href: "/dashboard/containers", label: "Containers", icon: "◫" },
  { href: "/dashboard/config", label: "Config", icon: "◆" },
  { href: "/dashboard/api-keys", label: "API Keys", icon: "◈" },
  { href: "/dashboard/providers", label: "Providers", icon: "◇" },
  { href: "/dashboard/usage", label: "Usage", icon: "◓" },
  { href: "/dashboard/quota", label: "Quota", icon: "◔" },
  { href: "/dashboard/settings", label: "Settings", icon: "◕" },
] as const;

export function DashboardNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, close } = useMobileSidebar();

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
          <h1 className="text-2xl font-bold tracking-tight text-white">
            CLIProxy
          </h1>
          <p className="mt-1 text-xs text-white/70">Management</p>
        </div>

        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
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
                  <span className="text-lg text-purple-300" aria-hidden="true">
                    {item.icon}
                  </span>
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
