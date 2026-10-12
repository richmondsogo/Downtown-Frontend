"use client";

import * as React from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { ListingCard } from "@/components/listing-card";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { Button } from "@/components/ui/button";
import type { SavedListingItem } from "@downtown/types";
import { Heart, ArrowRight, Loader2, BookmarkX, ShieldCheck } from "lucide-react";

export default function SavedListingsPage() {
  const { isAuthenticated, isPending } = useAuthGate();
  const [items, setItems] = React.useState<SavedListingItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchSaved() {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch("/api/listings/saved");
        if (!res.ok) {
          throw new Error("Failed to load your saved listings.");
        }
        const data = await res.json();
        setItems(data.items || []);
      } catch (err: any) {
        setError(err.message || "Failed to load saved items.");
      } finally {
        setIsLoading(false);
      }
    }

    if (!isPending) {
      fetchSaved();
    }
  }, [isAuthenticated, isPending]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-16 flex-1">
        {/* Navigation Header */}
        <Header />

        {/* Page Heading */}
        <div className="py-6 sm:py-8 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
              <Heart className="h-6 w-6 fill-current" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Saved Listings
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Keep track of items you are interested in across UNIOSUN campuses.
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="py-8">
          {/* Unauthenticated Guest State */}
          {!isPending && !isAuthenticated && (
            <div className="max-w-md mx-auto text-center py-12 px-4 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
              <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-foreground">
                Sign in to view your saved items
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your saved watchlist syncs across your devices so you can track listings and compare prices easily.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <Link href="/login?returnTo=/saved">
                  <Button className="w-full sm:w-auto">Sign In</Button>
                </Link>
                <Link href="/signup?returnTo=/saved">
                  <Button variant="outline" className="w-full sm:w-auto">
                    Create Account
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading your saved listings...</p>
            </div>
          )}

          {/* Error Banner */}
          {!isLoading && error && (
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm text-center">
              {error}
            </div>
          )}

          {/* Empty Watchlist State */}
          {!isLoading && isAuthenticated && items.length === 0 && !error && (
            <div className="max-w-md mx-auto text-center py-16 px-4 space-y-4">
              <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <BookmarkX className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold text-foreground">
                You haven&apos;t saved any listings yet
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                When you find something you like on Downtown, tap the heart icon on any card to save it here.
              </p>
              <div className="pt-2">
                <Link href="/">
                  <Button className="gap-2">
                    <span>Explore Feed</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Saved Items Grid */}
          {!isLoading && isAuthenticated && items.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{items.length} saved {items.length === 1 ? "item" : "items"}</span>
                <span>Sold items remain visible for reference</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
                {items.map(({ listing }) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
