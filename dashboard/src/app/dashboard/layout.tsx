import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { DashboardClientLayout } from "@/components/dashboard-client-layout";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();

  if (!session) {
    redirect("/login");
  }

  return <DashboardClientLayout>{children}</DashboardClientLayout>;
}
