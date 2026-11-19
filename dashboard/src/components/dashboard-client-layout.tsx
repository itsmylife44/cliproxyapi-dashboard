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
        <div className="flex min-h-screen flex-col bg-[var(--surface-base)] lg:flex-row">
          <DashboardNav />
          <main id="main-content" className="min-w-0 flex-1 px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-0 lg:px-8 lg:pb-20 lg:pt-4">
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
