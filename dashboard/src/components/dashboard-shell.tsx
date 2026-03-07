"use client";

import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { UserPanel } from "@/components/user-panel";
import { API_ENDPOINTS } from "@/lib/api-endpoints";

interface UserInfo {
  username: string;
  isAdmin: boolean;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.AUTH.ME);
        if (res.ok) {
          const data = await res.json();
          setUser({ username: data.username, isAdmin: data.isAdmin ?? false });
        }
      } catch {
        setUser(null);
      }
    };

    fetchUser();
  }, []);

  return (
    <>
      {user && (
        <DashboardHeader
          username={user.username}
          isAdmin={user.isAdmin}
          onUserClick={() => setPanelOpen(true)}
        />
      )}
      {children}
      {user && (
        <UserPanel
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          username={user.username}
          isAdmin={user.isAdmin}
        />
      )}
    </>
  );
}
