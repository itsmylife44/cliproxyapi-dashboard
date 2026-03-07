"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { UserPanel } from "@/components/user-panel";
import { API_ENDPOINTS } from "@/lib/api-endpoints";

interface ProxyStatus {
  running: boolean;
  containerName?: string;
  uptime?: number | null;
}

interface ProxyStatusContextValue {
  provide: (status: ProxyStatus | null) => void;
  clear: () => void;
}

const ProxyStatusContext = createContext<ProxyStatusContextValue>({
  provide: () => {},
  clear: () => {},
});

export function useProxyStatusProvider() {
  return useContext(ProxyStatusContext);
}

interface UserInfo {
  username: string;
  isAdmin: boolean;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [externalStatus, setExternalStatus] = useState<ProxyStatus | null | undefined>(undefined);

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

  const provide = useCallback((status: ProxyStatus | null) => {
    setExternalStatus(status);
  }, []);

  const clear = useCallback(() => {
    setExternalStatus(undefined);
  }, []);

  return (
    <ProxyStatusContext.Provider value={{ provide, clear }}>
      {user && (
        <DashboardHeader
          username={user.username}
          isAdmin={user.isAdmin}
          onUserClick={() => setPanelOpen(true)}
          externalStatus={externalStatus}
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
    </ProxyStatusContext.Provider>
  );
}
