"use client";

import * as React from "react";
import { CategoryPills, type CategoryItem } from "@/components/category-pills";
import { ListingCard } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import type { PublicListingCard, SearchResultPage } from "@downtown/types";
import { Loader2, PackageOpen, RefreshCw } from "lucide-react";

export interface HomeFeedProps {
  categories: CategoryItem[];
  initialListings: PublicListingCard[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
}

export function HomeFeed({
  categories,
  initialListings,
  initialNextCursor,
  initialHasMore,
}: HomeFeedProps) {
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [listings, setListings] = React.useState<PublicListingCard[]>(initialListings);
  const [nextCursor, setNextCursor] = React.useState<string | null>(initialNextCursor);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [isFiltering, setIsFiltering] = React.useState(false);

  const observerRef = React.useRef<HTMLDivElement>(null);

  // When selected category changes, re-fetch feed
  const handleCategorySelect = async (slug: string | null) => {
    setSelectedCategory(slug);
    setIsFiltering(true);

    try {
      const url = slug
        ? `/api/listings?category=${encodeURIComponent(slug)}&limit=16`
        : `/api/listings?limit=16`;
      const res = await fetch(url);
      if (res.ok) {
        const data: SearchResultPage = await res.json();
        setListings(data.items);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
    } catch (err) {
      console.error("Failed to filter by category:", err);
    } finally {
      setIsFiltering(false);
    }
  };

  // Load next page
  const handleLoadMore = React.useCallback(async () => {
    if (!nextCursor || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      let url = `/api/listings?cursor=${encodeURIComponent(nextCursor)}&limit=16`;
      if (selectedCategory) {
        url += `&category=${encodeURIComponent(selectedCategory)}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data: SearchResultPage = await res.json();
        setListings((prev) => [...prev, ...data.items]);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
    } catch (err) {
      console.error("Failed to load more listings:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore, hasMore, selectedCategory]);

  // Infinite scroll intersection observer
  React.useEffect(() => {
    if (!hasMore || isLoadingMore || isFiltering) return;

    const target = observerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: "300px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isFiltering, handleLoadMore]);

  return (
    <div className="w-full space-y-6">
      {/* Category Pills Filter */}
      <div className="w-full">
        <CategoryPills
          categories={categories}
          selectedSlug={selectedCategory}
          onSelect={handleCategorySelect}
        />
      </div>

      {/* Feed Status Header */}
      <div className="flex items-center justify-between pt-1">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
          {selectedCategory
            ? categories.find((c) => c.slug === selectedCategory)?.name || "Category Items"
            : "Latest Campus Finds"}
        </h2>
        {isFiltering && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Updating feed...</span>
          </div>
        )}
      </div>

      {/* Feed Grid with content-visibility: auto for smooth scrolling */}
      {listings.length === 0 && !isFiltering ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 px-4 text-center">
          <PackageOpen className="h-12 w-12 text-muted-foreground/60 mb-3" />
          <h3 className="text-base font-semibold text-foreground">No listings available</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
            There are currently no items listed in this section. Be the first to post a deal!
          </p>
          {selectedCategory && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCategorySelect(null)}
              className="rounded-xl"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Reset Category Filter
            </Button>
          )}
        </div>
      ) : (
        <div
          className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4"
          style={{ contentVisibility: "auto" }}
        >
          {listings.map((item, index) => (
            <ListingCard
              key={item.id}
              listing={item}
              priority={index < 4}
            />
          ))}
        </div>
      )}

      {/* Load More & Infinite Scroll Sentinel */}
      {hasMore && (
        <div className="flex flex-col items-center justify-center pt-4 pb-8">
          <div ref={observerRef} className="h-6 w-full" />
          {isLoadingMore ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Loading more campus finds...</span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="default"
              onClick={handleLoadMore}
              className="rounded-xl font-medium px-6 hover:bg-muted"
            >
              Load More Listings
            </Button>
          )}
        </div>
      )}

      {!hasMore && listings.length > 0 && (
        <div className="text-center py-6 text-xs text-muted-foreground border-t border-border/40">
          You've reached the end of the campus feed. Check back soon for new student listings!
        </div>
      )}
    </div>
  );
}
