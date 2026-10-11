"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldCheck, X } from "lucide-react";

export interface AuthGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  returnTo?: string;
}

export function AuthGateModal({
  isOpen,
  onClose,
  title = "Sign in to continue",
  description = "Downtown requires verified student, staff, or vendor accounts to contact sellers and make transactions safely.",
  returnTo = "/",
}: AuthGateModalProps) {
  if (!isOpen) return null;

  const loginUrl = `/login?returnTo=${encodeURIComponent(returnTo)}`;
  const signupUrl = `/signup?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-gate-title"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-md space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h3
              id="auth-gate-title"
              className="text-base font-semibold text-foreground tracking-tight"
            >
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          <Link href={loginUrl} onClick={onClose} className="w-full">
            <Button className="w-full">Sign In</Button>
          </Link>
          <Link href={signupUrl} onClick={onClose} className="w-full">
            <Button variant="outline" className="w-full">
              Create an Account
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-full text-muted-foreground text-xs h-9"
          >
            Continue browsing
          </Button>
        </div>
      </div>
    </div>
  );
}
