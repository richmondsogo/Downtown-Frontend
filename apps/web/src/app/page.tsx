"use client";

import * as React from "react";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuthGateModal } from "@/components/auth-gate-modal";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { formatNaira } from "@downtown/utils";
import {
  CheckCircle2,
  ShieldCheck,
  ShoppingBag,
  ArrowRight,
  MessageCircle,
} from "lucide-react";

export default function HomePage() {
  const { requireAuth, isModalOpen, closeModal, gateContext, isAuthenticated, user } =
    useAuthGate();
  const [contactSuccess, setContactSuccess] = React.useState(false);

  const handleContactSeller = () => {
    requireAuth(
      () => {
        // Authenticated action executed
        setContactSuccess(true);
        setTimeout(() => setContactSuccess(false), 5000);
      },
      {
        title: "Sign in to contact seller",
        description:
          "Downtown connects students directly with verified sellers. Please sign in or create an account to initiate deals.",
        returnTo: "/",
      }
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 sm:p-8 max-w-lg mx-auto bg-background">
      {/* Top Header with Guest / Authenticated profile state */}
      <Header />

      {/* Hero / Orientation */}
      <section className="w-full my-8 space-y-4 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm border border-border bg-muted text-xs text-muted-foreground font-medium">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" />
          <span>Trust-anchored campus commerce</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Buy and sell safely across campus.
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Downtown replaces chaotic WhatsApp status sales with verified student
          identities, listing moderation, and structured deals.
        </p>
      </section>

      {/* Sample Mobile-First Card Preview with Soft-Gated Action */}
      <section className="w-full space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Marketplace Preview
          </span>
          {isAuthenticated && (
            <span className="text-xs text-accent font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Signed in as {user?.name?.split(" ")[0]}
            </span>
          )}
        </div>

        {contactSuccess && (
          <div
            className="rounded-md border border-accent/20 bg-accent/10 p-3 text-xs text-accent flex items-start gap-2"
            role="status"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Soft-gate passed! Verified user session active. WhatsApp deal thread ready.
            </span>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-none">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Badge variant="verified" className="text-[10px] px-1.5 py-0">
                  Verified Student
                </Badge>
                <span>·</span>
                <span>Osogbo Campus</span>
              </div>
              <h2 className="font-semibold text-base text-foreground leading-snug">
                MacBook Air M1 (8GB / 256GB) Space Grey
              </h2>
            </div>
          </div>
          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <div>
              <span className="text-xs text-muted-foreground">Price</span>
              <div className="text-lg font-bold text-foreground">
                {formatNaira(480000)}
              </div>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleContactSeller}
              id="contact-seller-button"
            >
              <span>Contact Seller</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Bottom Actions */}
      <footer className="w-full mt-10 pt-4 border-t border-border flex flex-col gap-2.5">
        <Button variant="default" className="w-full gap-2">
          <ShoppingBag className="h-4 w-4" />
          <span>Browse Campus Listings</span>
        </Button>
        <p className="text-[11px] text-center text-muted-foreground">
          November 30, 2026 MVP Launch · Step 02 Authentication Stage
        </p>
      </footer>

      {/* Auth Soft-Gate Modal */}
      <AuthGateModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={gateContext.title}
        description={gateContext.description}
        returnTo={gateContext.returnTo}
      />
    </main>
  );
}
