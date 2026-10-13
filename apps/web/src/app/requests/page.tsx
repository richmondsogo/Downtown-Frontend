"use client";

import * as React from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { formatNaira, formatTimeAgo } from "@downtown/utils";
import {
  MessageSquare,
  Clock,
  ExternalLink,
  XCircle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import type { PurchaseRequest } from "@downtown/types";

export default function RequestsPage() {
  const { data: session, isPending: sessionLoading } = useSession();
  const [requests, setRequests] = React.useState<PurchaseRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);

  const fetchRequests = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/requests?type=buying");
      if (!res.ok) {
        if (res.status === 401) {
          setRequests([]);
          return;
        }
        throw new Error("Failed to load your purchase requests.");
      }
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err: any) {
      setError(err.message || "Failed to load requests.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!sessionLoading) {
      fetchRequests();
    }
  }, [sessionLoading, fetchRequests]);

  const handleCancel = async (requestId: string) => {
    if (!confirm("Are you sure you want to cancel this purchase request? The inventory reservation will be released immediately.")) {
      return;
    }
    setCancellingId(requestId);
    try {
      const res = await fetch(`/api/requests/${requestId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Buyer cancelled from requests page" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to cancel request.");
      }
      await fetchRequests();
    } catch (err: any) {
      alert(err.message || "Failed to cancel request.");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            My Purchase Requests
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Track your 24-hour inventory reservations and active WhatsApp seller handoffs.
          </p>
        </div>

        {/* Unauthenticated State */}
        {!sessionLoading && !session?.user && (
          <div className="rounded-lg border border-border bg-muted/40 p-8 text-center space-y-3">
            <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">
              Sign in to view your requests
            </h2>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Please sign in with your student, staff, or vendor account to manage your purchase requests.
            </p>
            <div className="pt-2">
              <Link href="/login?returnTo=/requests">
                <Button size="sm">Sign In</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && session?.user && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            <span>Loading your requests...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-md border border-destructive/20 bg-destructive/5 text-destructive text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={fetchRequests}>
              Retry
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && session?.user && requests.length === 0 && !error && (
          <div className="rounded-lg border border-border bg-muted/30 p-10 text-center space-y-3">
            <div className="h-12 w-12 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              No purchase requests yet
            </h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              When you find an item you like, click &ldquo;Contact Seller&rdquo; to place a 24-hour stock hold and chat directly on WhatsApp.
            </p>
            <div className="pt-2">
              <Link href="/">
                <Button size="sm" className="gap-1.5">
                  <span>Browse Marketplace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Requests List */}
        {!isLoading && requests.length > 0 && (
          <div className="space-y-3">
            {requests.map((req) => {
              const isHoldActive =
                req.status === "pending" &&
                new Date(req.reservationExpiresAt).getTime() > Date.now();

              return (
                <div
                  key={req.id}
                  className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-sm space-y-3 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                    <div className="space-y-0.5">
                      <Link
                        href={`/listings/${req.listingId}`}
                        className="text-sm sm:text-base font-bold text-foreground hover:underline line-clamp-1"
                      >
                        {req.listingTitle || "Listing Item"}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Seller: {req.sellerFirstName || "Seller"}</span>
                        <span>&bull;</span>
                        <span>Created {formatTimeAgo(req.createdAt)}</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {req.status === "pending" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{isHoldActive ? "Stock Held (24h)" : "Pending Outcome"}</span>
                        </span>
                      ) : req.status === "cancelled" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Cancelled</span>
                        </span>
                      ) : req.status === "expired" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Expired</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                          <span>{req.status}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Financial & Quantity Details */}
                  <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-foreground">
                    <div>
                      <span className="text-muted-foreground text-xs block">Unit Price</span>
                      <span className="font-semibold">{formatNaira(req.unitPrice)}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground text-xs block">Requested</span>
                      <span className="font-semibold">{req.requestedQuantity} unit{req.requestedQuantity > 1 ? "s" : ""}</span>
                    </div>

                    {req.offerPrice && (
                      <div>
                        <span className="text-muted-foreground text-xs block">Your Offer</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatNaira(req.offerPrice)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  {req.status === "pending" && (
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/40">
                      {req.whatsappUrl ? (
                        <a
                          href={req.whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex"
                        >
                          <Button size="sm" className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>Open WhatsApp</span>
                            <ExternalLink className="h-3 w-3 opacity-80" />
                          </Button>
                        </a>
                      ) : (
                        <span />
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={cancellingId === req.id}
                        onClick={() => handleCancel(req.id)}
                        className="h-9 text-xs text-muted-foreground hover:text-destructive"
                      >
                        {cancellingId === req.id ? "Cancelling..." : "Cancel Request"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
