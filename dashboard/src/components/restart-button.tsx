"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export function RestartButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();

  const handleRestart = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });

      if (!res.ok) {
        showToast("Failed to restart service", "error");
        setLoading(false);
        return;
      }

      showToast("Service restart initiated", "success");
      setIsModalOpen(false);
      setLoading(false);

      setTimeout(() => {
        router.refresh();
      }, 5000);
    } catch {
      showToast("Network error", "error");
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="danger" onClick={() => setIsModalOpen(true)}>
        Restart Service
      </Button>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <ModalHeader>
          <ModalTitle>Restart Service</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div className="border-l-4 border-red-400/60 bg-red-500/20 backdrop-blur-xl p-4 text-sm rounded-r-xl">
              <strong className="text-white">Warning:</strong> <span className="text-white/90">This will restart the CLIProxyAPI service.
              Active requests will be terminated.</span>
            </div>
            <p className="text-sm text-white/90">
              The service will be unavailable for a few seconds during restart.
              Are you sure you want to continue?
            </p>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRestart} disabled={loading}>
            {loading ? "Restarting..." : "Confirm Restart"}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
