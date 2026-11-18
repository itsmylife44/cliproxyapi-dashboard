"use client";

import { ToastProvider } from "@/components/ui/toast";
import { MobileSidebarProvider } from "@/components/mobile-sidebar-context";
import { LazyUpdateNotification } from "@/components/lazy-update-notification";
import { ProxyUpdateNotification } from "@/components/proxy-update-notification";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardNav } from "@/components/dashboard-nav";

interface DashboardClientLayoutProps {
  children: React.ReactNode;
}

export function DashboardClientLayout({ children }: DashboardClientLayoutProps) {
  return (
    <ToastProvider>
      <MobileSidebarProvider>
        <div className="grid min-h-screen grid-cols-1 overflow-x-clip bg-[var(--surface-base)] lg:grid-cols-[auto_1fr]">
          <DashboardNav />
          <main id="main-content" className="min-w-0 flex-1 overflow-x-clip px-4 pb-10 pt-0 lg:px-8 lg:pb-12 lg:pt-4">
            <div className="mx-auto w-full max-w-[1320px]">
              <DashboardShell>{children}</DashboardShell>
            </div>
          </main>
        </div>
        <LazyUpdateNotification />
        <ProxyUpdateNotification />
      </MobileSidebarProvider>
    </ToastProvider>
  );
}
