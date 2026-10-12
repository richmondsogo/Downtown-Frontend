"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { AuthGateModal } from "@/components/auth-gate-modal";
import { cn } from "@downtown/utils";

interface SaveButtonProps {
  listingId: string;
  initialSaved?: boolean;
  onToggle?: (saved: boolean) => void;
  showLabel?: boolean;
  className?: string;
}

/**
 * SaveButton Component
 * - Optimistic save/unsave toggle
 * - Opens AuthGateModal for unauthenticated guests
 * - Accessible touch target (>= 44px)
 */
export function SaveButton({
  listingId,
  initialSaved = false,
  onToggle,
  showLabel = false,
  className,
}: SaveButtonProps) {
  const [isSaved, setIsSaved] = React.useState(initialSaved);
  const [isLoading, setIsLoading] = React.useState(false);
  const { requireAuth, isModalOpen, closeModal, gateContext } = useAuthGate();

  React.useEffect(() => {
    setIsSaved(initialSaved);
  }, [initialSaved]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    requireAuth(
      async () => {
        const previousState = isSaved;
        const nextState = !previousState;
        setIsSaved(nextState);
        onToggle?.(nextState);

        try {
          setIsLoading(true);
          const res = await fetch(`/api/listings/${listingId}/save`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ saved: nextState }),
          });

          if (!res.ok) {
            // Revert optimistic state on failure
            setIsSaved(previousState);
            onToggle?.(previousState);
          } else {
            const data = await res.json();
            setIsSaved(data.saved);
            onToggle?.(data.saved);
          }
        } catch {
          setIsSaved(previousState);
          onToggle?.(previousState);
        } finally {
          setIsLoading(false);
        }
      },
      {
        title: "Sign in to save listings",
        description:
          "Save this item to your personal watchlist so you can easily compare prices and return to it later.",
      }
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        aria-label={isSaved ? "Remove from saved" : "Save listing"}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-full transition-all cursor-pointer min-h-[44px] min-w-[44px]",
          isSaved
            ? "text-red-500 hover:text-red-600"
            : "text-muted-foreground hover:text-foreground",
          className
        )}
      >
        <Heart
          className={cn(
            "h-5 w-5 transition-transform duration-150 active:scale-125",
            isSaved ? "fill-current text-red-500" : "stroke-[1.75]"
          )}
        />
        {showLabel && (
          <span className="text-sm font-medium">
            {isSaved ? "Saved" : "Save"}
          </span>
        )}
      </button>

      <AuthGateModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={gateContext.title}
        description={gateContext.description}
        returnTo={gateContext.returnTo}
      />
    </>
  );
}
