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
           <main className="flex-1 p-3 pt-16 lg:p-5 lg:pt-8">{children}</main>
         </div>
         <UpdateNotification />
       </MobileSidebarProvider>
    </ToastProvider>
  );
}
