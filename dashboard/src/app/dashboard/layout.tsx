import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { verifySession } from "@/lib/auth/session";
import { DashboardNav } from "@/components/dashboard-nav";
import { ToastProvider } from "@/components/ui/toast";
import { MobileSidebarProvider } from "@/components/mobile-sidebar-context";
import { MobileTopBar } from "@/components/mobile-top-bar";
const UpdateNotification = dynamic(
  () => import("@/components/update-notification").then(mod => ({ default: mod.UpdateNotification })),
  { ssr: false }
);
import { ProxyUpdateNotification } from "@/components/proxy-update-notification";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();

  if (!session) {
    redirect("/login");
  }

  return (
    <ToastProvider>
      <MobileSidebarProvider>
         <MobileTopBar />
         <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[auto_1fr]">
           <DashboardNav />
            <main className="min-w-0 flex-1 px-3 pb-4 pt-16 lg:px-6 lg:pb-6 lg:pt-6">
              <div className="mx-auto w-full max-w-[1320px]">
                <DashboardShell>{children}</DashboardShell>
              </div>
            </main>
          </div>
          <UpdateNotification />
          <ProxyUpdateNotification />
        </MobileSidebarProvider>
    </ToastProvider>
  );
}
