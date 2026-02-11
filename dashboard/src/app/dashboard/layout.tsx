import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { DashboardNav } from "@/components/dashboard-nav";
import { ToastProvider } from "@/components/ui/toast";
import { MobileSidebarProvider } from "@/components/mobile-sidebar-context";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { UpdateNotification } from "@/components/update-notification";

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
         <div className="flex min-h-screen">
           <DashboardNav />
            <main className="flex-1 px-3 pb-4 pt-16 lg:px-6 lg:pb-6 lg:pt-6">
              <div className="mx-auto w-full max-w-[1320px]">{children}</div>
            </main>
          </div>
          <UpdateNotification />
        </MobileSidebarProvider>
    </ToastProvider>
  );
}
