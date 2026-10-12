import * as React from "react";
import { ShieldCheck, MapPin, Calendar, Package, UserCheck } from "lucide-react";
import type { SellerTrustProfile } from "@downtown/types";
import { cn } from "@downtown/utils";

interface SellerTrustCardProps {
  seller: SellerTrustProfile;
  className?: string;
}

/**
 * SellerTrustCard Component
 * Displays the seller's verification badges, campus affiliation, and marketplace standing.
 * Strictly guarantees privacy: zero email, phone, matric number, or user ID is exposed.
 */
export function SellerTrustCard({ seller, className }: SellerTrustCardProps) {
  const initials = seller.displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 sm:p-5 text-card-foreground shadow-sm",
        className
      )}
    >
      <div className="flex items-start gap-3.5 sm:gap-4">
        {/* Avatar or Initials Badge */}
        <div className="relative shrink-0">
          {seller.avatarUrl ? (
            <img
              src={seller.avatarUrl}
              alt={seller.displayName}
              className="h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-base sm:text-lg border border-primary/20">
              {initials || "S"}
            </div>
          )}

          {seller.isVerifiedSeller && (
            <span
              className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-2 ring-card"
              title="Verified Campus Seller"
            >
              <ShieldCheck className="h-3 w-3" />
            </span>
          )}
        </div>

        {/* Identity & Badges */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <h3 className="font-semibold text-base sm:text-lg tracking-tight text-foreground truncate">
              {seller.displayName}
            </h3>

            {seller.isVerifiedSeller && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                <ShieldCheck className="h-3 w-3 shrink-0" />
                Verified Seller
              </span>
            )}
          </div>

          {/* Student Status Badge */}
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
            <span
              title={
                seller.studentVerificationStatus === "verified"
                  ? "Verification is performed by Downtown through student ID inspection, not by the university."
                  : undefined
              }
              className="cursor-help"
            >
              {seller.studentVerificationStatus === "verified"
                ? "Verified student seller"
                : seller.studentVerificationStatus === "pending"
                ? "Student (Verification Pending)"
                : "Student Community Seller"}
            </span>
          </div>
        </div>
      </div>

      {/* Meta Credentials Grid */}
      <div className="mt-4 pt-3.5 border-t border-border/60 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
          <span className="truncate">{seller.campusName}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
          <span>Joined {seller.memberSince}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
          <span>{seller.totalActiveListings ?? 1} active listings</span>
        </div>
      </div>
    </div>
  );
}
