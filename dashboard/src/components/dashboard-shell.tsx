"use client";

import { useState, useCallback, useMemo, createContext, useContext } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { UserPanel } from "@/components/user-panel";
import { useAuth } from "@/hooks/use-auth";

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

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [panelOpen, setPanelOpen] = useState(false);
  const [externalStatus, setExternalStatus] = useState<ProxyStatus | null | undefined>(undefined);

  const provide = useCallback((status: ProxyStatus | null) => {
    setExternalStatus(status);
  }, []);

  const clear = useCallback(() => {
    setExternalStatus(undefined);
  }, []);

  const contextValue = useMemo(() => ({ provide, clear }), [provide, clear]);

  return (
    <ProxyStatusContext.Provider value={contextValue}>
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
