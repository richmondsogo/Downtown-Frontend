"use client";

import * as React from "react";
import { useSession } from "@/lib/auth-client";

export function useAuthGate() {
  const { data: session, isPending } = useSession();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [gateContext, setGateContext] = React.useState<{
    title?: string;
    description?: string;
    returnTo?: string;
  }>({});

  const requireAuth = React.useCallback(
    (
      action: () => void,
      options?: {
        title?: string;
        description?: string;
        returnTo?: string;
      }
    ) => {
      if (session?.user) {
        action();
      } else {
        setGateContext({
          title: options?.title,
          description: options?.description,
          returnTo: options?.returnTo || (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/"),
        });
        setIsModalOpen(true);
      }
    },
    [session]
  );

  const closeModal = React.useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return {
    isAuthenticated: !!session?.user,
    isPending,
    user: session?.user,
    requireAuth,
    isModalOpen,
    closeModal,
    gateContext,
  };
}
