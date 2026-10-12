import * as React from "react";
import Link from "next/link";
import { formatNaira, cn } from "@downtown/utils";
import type { PublicListingCard } from "@downtown/types";
import { BadgeCheck, MapPin } from "lucide-react";

export interface ListingCardProps {
  listing: PublicListingCard;
  priority?: boolean;
  className?: string;
}

const CONDITION_LABELS: Record<string, string> = {
  new: "Brand New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
};

export function ListingCard({ listing, priority = false, className }: ListingCardProps) {
  const isSold = listing.availability === "sold";
  const isReserved = listing.availability === "reserved";
  const displayPrice = formatNaira(Math.round(listing.price / 100));

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:border-primary/40 hover:shadow-md",
        isSold && "opacity-85",
        className
      )}
    >
      <Link
        href={`/listings/${listing.id}`}
        className="flex flex-col h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
        aria-label={`${listing.title} - ${displayPrice}`}
      >
        {/* Photo Container with explicit 4:3 aspect ratio */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {listing.thumb ? (
            <img
              src={listing.thumb.url}
              alt={listing.title}
              width={400}
              height={300}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              className={cn(
                "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
                isSold && "grayscale-[40%]"
              )}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground text-sm font-medium">
              No Photo
            </div>
          )}

          {/* Badges Overlay */}
          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
            {listing.condition && (
              <span className="inline-flex items-center rounded-md bg-background/90 backdrop-blur-sm px-2 py-0.5 text-xs font-medium text-foreground shadow-sm">
                {CONDITION_LABELS[listing.condition] || listing.condition}
              </span>
            )}
            {isReserved && (
              <span className="inline-flex items-center rounded-md bg-amber-500/90 text-white backdrop-blur-sm px-2 py-0.5 text-xs font-semibold shadow-sm">
                Reserved
              </span>
            )}
            {isSold && (
              <span className="inline-flex items-center rounded-md bg-zinc-700/90 text-white backdrop-blur-sm px-2 py-0.5 text-xs font-semibold shadow-sm">
                Sold
              </span>
            )}
          </div>
        </div>

        {/* Card Details */}
        <div className="flex flex-1 flex-col p-3.5 sm:p-4">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              {displayPrice}
            </span>
            {listing.isNegotiable && (
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Negotiable
              </span>
            )}
          </div>

          <h3 className="line-clamp-2 text-sm font-medium text-foreground group-hover:text-primary transition-colors mb-2 leading-snug">
            {listing.title}
          </h3>

          <div className="mt-auto pt-2 flex flex-col gap-1.5 border-t border-border/60 text-xs text-muted-foreground">
            {/* Location */}
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
              <span className="truncate">
                {listing.locationName ? `${listing.campusName || "UNIOSUN"} • ${listing.locationName}` : listing.campusName || "Main Campus"}
              </span>
            </div>

            {/* Seller */}
            <div className="flex items-center justify-between gap-1 pt-0.5">
              <span className="truncate text-[11px] font-medium text-foreground/80">
                {listing.seller.displayName}
              </span>
              {listing.seller.isVerified && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  <span>Verified</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
