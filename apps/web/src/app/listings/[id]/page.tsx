import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { PhotoCarousel } from "@/components/photo-carousel";
import { SellerTrustCard } from "@/components/seller-trust-card";
import { CampusSafetyNotice } from "@/components/campus-safety-notice";
import { SaveButton } from "@/components/save-button";
import { ViewTracker } from "./view-tracker";
import { getApiBaseUrl } from "@/lib/api";
import { formatNaira, formatTimeAgo, cn } from "@downtown/utils";
import type { PublicListingDetail } from "@downtown/types";
import {
  ChevronRight,
  MapPin,
  Building2,
  Eye,
  Clock,
  Lock,
  Tag,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ id: string }>;
}

const CONDITION_LABELS: Record<string, string> = {
  new: "Brand New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
};

async function getListing(id: string): Promise<PublicListingDetail | null> {
  const apiBaseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${apiBaseUrl}/api/listings/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch listing detail:", err);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing) {
    return {
      title: "Listing Not Found | Downtown",
      description: "The requested listing could not be found.",
    };
  }

  const priceText = formatNaira(listing.price);
  const ogTitle = `${listing.title} - ${priceText} | Downtown`;
  const ogDesc = listing.description
    ? listing.description.slice(0, 160)
    : `Buy ${listing.title} for ${priceText} on Downtown UNIOSUN marketplace.`;
  const primaryImage = listing.photos[0]?.url;

  return {
    title: ogTitle,
    description: ogDesc,
    openGraph: {
      title: ogTitle,
      description: ogDesc,
      type: "website",
      siteName: "Downtown",
      images: primaryImage
        ? [
            {
              url: primaryImage,
              width: listing.photos[0]?.width || 800,
              height: listing.photos[0]?.height || 600,
              alt: listing.title,
            },
          ]
        : [],
    },
  };
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing) {
    notFound();
  }

  const isSold = listing.availability === "sold" || listing.status === "sold";
  const isReserved = listing.availability === "reserved" || listing.status === "reserved";
  const displayPrice = formatNaira(listing.price);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <ViewTracker listingId={listing.id} />

      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-16 flex-1">
        {/* Navigation Header */}
        <Header />

        {/* Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          className="py-3 sm:py-4 flex items-center gap-1.5 text-xs text-muted-foreground overflow-x-auto scrollbar-none"
        >
          <Link href="/" className="hover:text-foreground transition-colors shrink-0">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          <Link
            href={`/search?categoryId=${listing.category.id}`}
            className="hover:text-foreground transition-colors shrink-0"
          >
            {listing.category.name}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          <span className="text-foreground font-medium truncate max-w-[200px] sm:max-w-[300px]">
            {listing.title}
          </span>
        </nav>

        {/* Status Warning Banners */}
        {isSold && (
          <div className="mb-4 sm:mb-6 rounded-xl border border-zinc-700/40 bg-zinc-800/20 p-4 text-sm text-foreground flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-zinc-400 shrink-0" />
            <div>
              <strong>This listing has been marked as sold.</strong> It is kept visible for price reference and buyer safety history.
            </div>
          </div>
        )}

        {isReserved && (
          <div className="mb-4 sm:mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400 flex items-center gap-3">
            <Clock className="h-5 w-5 shrink-0" />
            <div>
              <strong>Currently reserved.</strong> Another student has initiated a trade. You can still save it to track if it becomes available again.
            </div>
          </div>
        )}

        {/* Main 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
          {/* Left Column: Gallery, Description & Safety Notice */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8">
            {/* Accessible Image Carousel */}
            <PhotoCarousel photos={listing.photos} title={listing.title} />

            {/* Description Card */}
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3.5 shadow-sm">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Item Description
              </h2>
              <div className="text-sm sm:text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {listing.description || "No additional description provided by the seller."}
              </div>

              {/* Meta tags (Posting date & View counter) */}
              <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Posted {formatTimeAgo(listing.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  <span>{listing.viewCount} views</span>
                </div>
              </div>
            </div>

            {/* Campus Safety Notice */}
            <CampusSafetyNotice />
          </div>

          {/* Right Column: Pricing, Seller Trust, Actions */}
          <div className="lg:col-span-5 space-y-5 sm:space-y-6 lg:sticky lg:top-20">
            {/* Primary Listing Card */}
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
              {/* Category & Condition Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground border border-border">
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    {listing.category.name}
                  </span>

                  {listing.condition && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                      {CONDITION_LABELS[listing.condition] || listing.condition}
                    </span>
                  )}
                </div>

                {/* Save Watchlist Toggle Button */}
                <SaveButton
                  listingId={listing.id}
                  initialSaved={listing.isSaved}
                  showLabel={true}
                  className="px-3 py-1 bg-muted/60 hover:bg-muted border border-border text-xs rounded-full min-h-[36px]"
                />
              </div>

              {/* Title */}
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
                {listing.title}
              </h1>

              {/* Price Row */}
              <div className="flex items-baseline gap-3 pt-1 border-t border-border/60">
                <span className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {displayPrice}
                </span>
                {listing.isNegotiable && (
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                    Negotiable
                  </span>
                )}
              </div>

              {/* Location Badge & Campus Details */}
              <div className="flex items-start gap-2 pt-2 text-xs sm:text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {listing.location.campusName || "UNIOSUN Campus"}
                  </span>
                  <span className="text-xs">
                    {listing.location.name && listing.location.name !== listing.location.campusName
                      ? listing.location.name
                      : "Campus-wide pickup"}
                  </span>
                </div>
              </div>

              {/* Contact Seller Action Box (Disabled placeholder for Step 07) */}
              <div className="pt-3 border-t border-border/60 space-y-2">
                <Button
                  disabled
                  className="w-full h-12 text-sm sm:text-base font-semibold opacity-80 cursor-not-allowed bg-muted text-muted-foreground border border-border"
                  aria-label="Direct messaging unlocks in Step 07"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  <span>Contact Seller (Unlocks in Step 07)</span>
                </Button>
                <p className="text-center text-[11px] text-muted-foreground leading-tight">
                  Direct seller chat and verified WhatsApp handoff activate in Step 07 to protect student safety.
                </p>
              </div>
            </div>

            {/* Seller Trust Profile Card */}
            <SellerTrustCard seller={listing.seller} />

            {/* Back to Feed Link */}
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Return to marketplace feed</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
