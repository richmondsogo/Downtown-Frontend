"use client";

import * as React from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuthGateModal } from "@/components/auth-gate-modal";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { canSell, formatNaira, cn } from "@downtown/utils";
import {
  Plus,
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertCircle,
  Edit,
  Trash2,
  Store,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import type { Listing } from "@downtown/types";

export default function SellDashboardPage() {
  const { isAuthenticated, isPending, user, requireAuth, isModalOpen, closeModal, gateContext } =
    useAuthGate();

  const [listings, setListings] = React.useState<Listing[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeFilter, setActiveFilter] = React.useState<"all" | "published" | "pending_moderation" | "draft">("all");
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const isSeller = canSell(user as any);

  const fetchListings = React.useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const res = await fetch("/api/listings/mine");
      if (res.ok) {
        const data = await res.json();
        setListings(data);
      }
    } catch (e) {
      console.error("Failed to fetch listings:", e);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    if (!isPending) {
      fetchListings();
    }
  }, [isPending, fetchListings]);

  const handleDeleteDraft = async (id: string) => {
    if (!confirm("Are you sure you want to delete this draft?")) return;
    try {
      setDeleteId(id);
      const res = await fetch(`/api/listings/${id}`, { method: "DELETE" });
      if (res.ok) {
        setListings((prev) => prev.filter((l) => l.id !== id));
      }
    } catch (e) {
      console.error("Delete draft failed:", e);
    } finally {
      setDeleteId(null);
    }
  };

  const filteredListings = listings.filter((item) => {
    if (activeFilter === "all") return true;
    return item.status === activeFilter;
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Seller Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your campus items, drafts, and listings on Downtown.
            </p>
          </div>

          {isAuthenticated && isSeller && (
            <Link href="/sell/new">
              <Button className="h-10 px-4 font-semibold gap-2 shadow-xs">
                <Plus className="h-4 w-4" />
                Post New Item
              </Button>
            </Link>
          )}
        </div>

        {/* State 1: Loading */}
        {isPending || (isLoading && isAuthenticated) ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading your listings...</p>
          </div>
        ) : !isAuthenticated ? (
          /* State 2: Guest / Not Signed In (Soft gate) */
          <div className="py-16 px-6 text-center max-w-md mx-auto border border-border rounded-2xl bg-card shadow-xs space-y-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Sign in to start selling
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Downtown connects verified students and vendors across UNIOSUN campuses.
              Sign in or create an account to list items.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/login?returnTo=/sell">
                <Button className="w-full sm:w-auto px-6">Sign In</Button>
              </Link>
              <Link href="/signup?returnTo=/sell">
                <Button variant="outline" className="w-full sm:w-auto px-6">
                  Create Account
                </Button>
              </Link>
            </div>
          </div>
        ) : !isSeller ? (
          /* State 3: Not a Seller Explainer */
          <div className="py-12 px-6 text-center max-w-lg mx-auto border border-border rounded-2xl bg-card shadow-xs space-y-4">
            <div className="h-12 w-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
              <Store className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Become a Verified Seller
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To keep transactions safe, all sellers must complete identity verification.
              Seller onboarding and student ID review are coming in Step 10.
            </p>
            <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground text-left space-y-1">
              <p className="font-medium text-foreground">Developer Note:</p>
              <p>
                To test selling right now, your account status can be flipped to verified
                using database test seeds or admin scripts.
              </p>
            </div>
            <div className="pt-2">
              <Link href="/">
                <Button variant="outline">Browse Marketplace</Button>
              </Link>
            </div>
          </div>
        ) : (
          /* State 4: Verified Seller Dashboard */
          <div className="space-y-6">
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
              {[
                { key: "all", label: `All (${listings.length})` },
                {
                  key: "published",
                  label: `Live (${listings.filter((l) => l.status === "published").length})`,
                },
                {
                  key: "pending_moderation",
                  label: `Under Review (${listings.filter((l) => l.status === "pending_moderation").length})`,
                },
                {
                  key: "draft",
                  label: `Drafts (${listings.filter((l) => l.status === "draft").length})`,
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0",
                    activeFilter === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Empty state */}
            {filteredListings.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-border rounded-xl p-8 space-y-3">
                <div className="h-10 w-10 rounded-full bg-muted mx-auto flex items-center justify-center text-muted-foreground">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  No listings found
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  {activeFilter === "all"
                    ? "You haven't created any items yet. Sell textbooks, gadgets, or hostel essentials to students."
                    : `No items matching the '${activeFilter}' filter.`}
                </p>
                {activeFilter === "all" && (
                  <Link href="/sell/new" className="inline-block pt-2">
                    <Button size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Create First Listing
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              /* Listing Grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredListings.map((item) => {
                  const coverPhoto = item.photos?.[0];
                  return (
                    <div
                      key={item.id}
                      className="border border-border rounded-xl bg-card overflow-hidden shadow-xs flex flex-col justify-between hover:border-border/80 transition-all"
                    >
                      {/* Image Thumbnail */}
                      <div className="relative aspect-4/3 bg-muted/40">
                        {coverPhoto ? (
                          <img
                            src={coverPhoto.thumbUrl || coverPhoto.url}
                            alt={item.title}
                            width={coverPhoto.width}
                            height={coverPhoto.height}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                            No photo
                          </div>
                        )}

                        {/* Status Badges strictly per prompt: Draft, Under review, Live */}
                        <div className="absolute top-2 left-2">
                          {item.status === "published" && (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white border-0 text-[10px] font-medium px-2 py-0.5">
                              Live
                            </Badge>
                          )}
                          {item.status === "pending_moderation" && (
                            <Badge className="bg-amber-600 hover:bg-amber-600 text-white border-0 text-[10px] font-medium px-2 py-0.5">
                              Under review
                            </Badge>
                          )}
                          {item.status === "draft" && (
                            <Badge variant="outline" className="bg-background/90 text-muted-foreground text-[10px] font-medium px-2 py-0.5">
                              Draft
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                              {item.title}
                            </h3>
                          </div>
                          <p className="text-sm font-bold text-primary mt-1">
                            {formatNaira(item.price)}
                            {item.isNegotiable && (
                              <span className="text-[10px] font-normal text-muted-foreground ml-1">
                                (Negotiable)
                              </span>
                            )}
                          </p>
                          {item.location && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              📍 {item.location.name}
                            </p>
                          )}
                        </div>

                        {/* Under review notice */}
                        {item.status === "pending_moderation" && (
                          <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400">
                            Listing is under automated review and will go live once cleared.
                          </div>
                        )}

                        {/* Card Actions */}
                        <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                          <Link href={`/sell/${item.id}/edit`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1.5"
                            >
                              <Edit className="h-3 w-3" />
                              Edit
                            </Button>
                          </Link>

                          {item.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deleteId === item.id}
                              onClick={() => handleDeleteDraft(item.id)}
                              className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Auth Gate Modal */}
      <AuthGateModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={gateContext.title}
        description={gateContext.description}
        returnTo={gateContext.returnTo}
      />
    </div>
  );
}
