"use client";

import { ToastProvider } from "@/components/ui/toast";
import { MobileSidebarProvider } from "@/components/mobile-sidebar-context";
import { MobileTopBar } from "@/components/mobile-top-bar";
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
        <MobileTopBar />
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[auto_1fr]">
          <DashboardNav />
          <main id="main-content" className="min-w-0 flex-1 px-3 pb-4 pt-16 lg:px-6 lg:pb-6 lg:pt-6">
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
