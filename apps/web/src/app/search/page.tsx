"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { SearchBar } from "@/components/search-bar";
import { ListingCard } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import type { PublicListingCard, SearchResultPage, SearchSortOption } from "@downtown/types";
import {
  SlidersHorizontal,
  ArrowUpDown,
  X,
  Loader2,
  PackageOpen,
  Check,
  RotateCcw,
} from "lucide-react";
import { cn } from "@downtown/utils";

const CAMPUSES = [
  { id: "campus_osogbo", name: "Osogbo (Main)" },
  { id: "campus_ikire", name: "Ikire" },
  { id: "campus_okuku", name: "Okuku" },
  { id: "campus_ifetedo", name: "Ifetedo" },
  { id: "campus_ipetu_ijesha", name: "Ipetu-Ijesha" },
  { id: "campus_ejigbo", name: "Ejigbo" },
];

const CATEGORIES = [
  { id: "cat_electronics", name: "Electronics" },
  { id: "cat_fashion_accessories", name: "Fashion & Accessories" },
  { id: "cat_home_living", name: "Home & Living" },
  { id: "cat_books_study_materials", name: "Books & Study Materials" },
  { id: "cat_food_drinks", name: "Food & Drinks" },
  { id: "cat_beauty_personal_care", name: "Beauty & Personal Care" },
  { id: "cat_services", name: "Services" },
  { id: "cat_tickets_events", name: "Tickets & Events" },
  { id: "cat_other", name: "Other" },
];

const CONDITIONS = [
  { value: "new", label: "Brand New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

const SORT_OPTIONS: { value: SearchSortOption; label: string }[] = [
  { value: "relevance", label: "Most Relevant" },
  { value: "newest", label: "Newest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read URL query parameters
  const queryParam = searchParams.get("q") || "";
  const categoryParam = searchParams.get("categoryId") || "";
  const campusParam = searchParams.get("campusId") || "";
  const minPriceParam = searchParams.get("minPrice") || "";
  const maxPriceParam = searchParams.get("maxPrice") || "";
  const conditionParam = searchParams.get("condition") || "";
  const verifiedOnlyParam = searchParams.get("verifiedOnly") === "true";
  const availabilityParam = searchParams.get("availability") || "all";
  const sortParam = (searchParams.get("sort") as SearchSortOption) || "relevance";

  // Results State
  const [items, setItems] = React.useState<PublicListingCard[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  // Filter Drawer State (Mobile / Desktop)
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);

  // Local filter drafts for drawer
  const [selectedCategory, setSelectedCategory] = React.useState(categoryParam);
  const [selectedCampus, setSelectedCampus] = React.useState(campusParam);
  const [minPrice, setMinPrice] = React.useState(minPriceParam);
  const [maxPrice, setMaxPrice] = React.useState(maxPriceParam);
  const [selectedConditions, setSelectedConditions] = React.useState<string[]>(
    conditionParam ? conditionParam.split(",") : []
  );
  const [verifiedOnly, setVerifiedOnly] = React.useState(verifiedOnlyParam);
  const [availability, setAvailability] = React.useState(availabilityParam);
  const [sort, setSort] = React.useState<SearchSortOption>(sortParam);

  const observerRef = React.useRef<HTMLDivElement>(null);

  // Synchronize local filter state when URL changes
  React.useEffect(() => {
    setSelectedCategory(categoryParam);
    setSelectedCampus(campusParam);
    setMinPrice(minPriceParam);
    setMaxPrice(maxPriceParam);
    setSelectedConditions(conditionParam ? conditionParam.split(",") : []);
    setVerifiedOnly(verifiedOnlyParam);
    setAvailability(availabilityParam);
    setSort(sortParam);
  }, [categoryParam, campusParam, minPriceParam, maxPriceParam, conditionParam, verifiedOnlyParam, availabilityParam, sortParam]);

  // Construct search query string
  const buildSearchUrl = React.useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (queryParam) params.set("q", queryParam);
      if (selectedCategory) params.set("categoryId", selectedCategory);
      if (selectedCampus) params.set("campusId", selectedCampus);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (selectedConditions.length > 0) params.set("condition", selectedConditions.join(","));
      if (verifiedOnly) params.set("verifiedOnly", "true");
      if (availability && availability !== "all") params.set("availability", availability);
      if (sort && sort !== "relevance") params.set("sort", sort);
      if (cursor) params.set("cursor", cursor);
      params.set("limit", "20");
      return `/api/listings?${params.toString()}`;
    },
    [queryParam, selectedCategory, selectedCampus, minPrice, maxPrice, selectedConditions, verifiedOnly, availability, sort]
  );

  // Push filter changes to URL
  const applyFiltersToUrl = (newSort?: SearchSortOption) => {
    const params = new URLSearchParams();
    if (queryParam) params.set("q", queryParam);
    if (selectedCategory) params.set("categoryId", selectedCategory);
    if (selectedCampus) params.set("campusId", selectedCampus);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (selectedConditions.length > 0) params.set("condition", selectedConditions.join(","));
    if (verifiedOnly) params.set("verifiedOnly", "true");
    if (availability && availability !== "all") params.set("availability", availability);
    const activeSort = newSort || sort;
    if (activeSort && activeSort !== "relevance") params.set("sort", activeSort);

    router.replace(`/search?${params.toString()}`);
    setIsFilterOpen(false);
  };

  const handleResetFilters = () => {
    setSelectedCategory("");
    setSelectedCampus("");
    setMinPrice("");
    setMaxPrice("");
    setSelectedConditions([]);
    setVerifiedOnly(false);
    setAvailability("all");
    setSort("relevance");

    const params = new URLSearchParams();
    if (queryParam) params.set("q", queryParam);
    router.replace(`/search?${params.toString()}`);
    setIsFilterOpen(false);
  };

  // Fetch initial results when URL search params change
  React.useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    const url = `/api/listings?${searchParams.toString()}&limit=20`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Search failed");
        return res.json();
      })
      .then((data: SearchResultPage) => {
        if (!isCancelled) {
          setItems(data.items);
          setNextCursor(data.nextCursor);
          setHasMore(data.hasMore);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Search error:", err);
        if (!isCancelled) {
          setItems([]);
          setNextCursor(null);
          setHasMore(false);
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [searchParams]);

  // Load next page
  const handleLoadMore = React.useCallback(async () => {
    if (!nextCursor || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const url = `/api/listings?${searchParams.toString()}&cursor=${encodeURIComponent(nextCursor)}&limit=20`;
      const res = await fetch(url);
      if (res.ok) {
        const data: SearchResultPage = await res.json();
        setItems((prev) => [...prev, ...data.items]);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
    } catch (err) {
      console.error("Failed to load more search results:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore, hasMore, searchParams]);

  // Infinite scroll observer
  React.useEffect(() => {
    if (!hasMore || isLoadingMore || isLoading) return;

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
  }, [hasMore, isLoadingMore, isLoading, handleLoadMore]);

  const hasActiveFilters =
    Boolean(selectedCategory) ||
    Boolean(selectedCampus) ||
    Boolean(minPrice) ||
    Boolean(maxPrice) ||
    selectedConditions.length > 0 ||
    verifiedOnly ||
    availability !== "all";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <Header />

        {/* Search Header Bar */}
        <div className="py-4 border-b border-border space-y-4">
          <div className="max-w-2xl">
            <SearchBar initialQuery={queryParam} autoFocus={!queryParam} />
          </div>

          {/* Quick Filter & Sort Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Button
                variant={hasActiveFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="rounded-xl gap-2 font-medium"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Filters</span>
                {hasActiveFilters && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground text-[10px] font-bold text-primary">
                    •
                  </span>
                )}
              </Button>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="rounded-xl text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">Sort:</span>
              <select
                aria-label="Sort search results"
                value={sort}
                onChange={(e) => {
                  const newSort = e.target.value as SearchSortOption;
                  setSort(newSort);
                  applyFiltersToUrl(newSort);
                }}
                className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Main Content Layout with Optional Filter Drawer */}
        <div className="mt-6 flex gap-8">
          {/* Filter Sidebar (Desktop) / Slide-over (Mobile) */}
          {isFilterOpen && (
            <aside className="w-full sm:w-72 shrink-0 space-y-6 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all animate-in fade-in-50">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-sm font-bold text-foreground">Filter Listings</h3>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-md"
                  aria-label="Close filters"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Campus Filter */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Campus
                </label>
                <select
                  aria-label="Filter by campus"
                  value={selectedCampus}
                  onChange={(e) => setSelectedCampus(e.target.value)}
                  className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="">All Campuses</option>
                  {CAMPUSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Category
                </label>
                <select
                  aria-label="Filter by category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Range */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Price Range (₦)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full h-9 rounded-xl border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <span className="text-xs text-muted-foreground">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full h-9 rounded-xl border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
              </div>

              {/* Condition */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Condition
                </label>
                <div className="space-y-1.5">
                  {CONDITIONS.map((cond) => {
                    const checked = selectedConditions.includes(cond.value);
                    return (
                      <label
                        key={cond.value}
                        className="flex items-center gap-2 text-xs text-foreground cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedConditions((prev) => [...prev, cond.value]);
                            } else {
                              setSelectedConditions((prev) => prev.filter((v) => v !== cond.value));
                            }
                          }}
                          className="rounded border-input text-primary focus:ring-primary"
                        />
                        <span>{cond.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Seller Verification Toggle */}
              <div className="pt-2 border-t border-border">
                <label className="flex items-center justify-between gap-2 text-xs font-medium text-foreground cursor-pointer">
                  <span>Verified Sellers Only</span>
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={(e) => setVerifiedOnly(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                </label>
              </div>

              {/* Availability Filter */}
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Item Availability
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="availability"
                      value="all"
                      checked={availability === "all"}
                      onChange={() => setAvailability("all")}
                      className="text-primary focus:ring-primary"
                    />
                    <span>All items (including sold)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="availability"
                      value="in_stock"
                      checked={availability === "in_stock"}
                      onChange={() => setAvailability("in_stock")}
                      className="text-primary focus:ring-primary"
                    />
                    <span>In stock only</span>
                  </label>
                </div>
              </div>

              {/* Apply / Reset Buttons */}
              <div className="pt-4 border-t border-border flex items-center gap-2">
                <Button
                  className="w-full rounded-xl"
                  size="sm"
                  onClick={() => applyFiltersToUrl()}
                >
                  Apply Filters
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl text-xs"
                  size="sm"
                  onClick={handleResetFilters}
                >
                  Clear
                </Button>
              </div>
            </aside>
          )}

          {/* Search Results Grid */}
          <main className="flex-1 space-y-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                {queryParam ? (
                  <>
                    Search results for <span className="text-primary">"{queryParam}"</span>
                  </>
                ) : (
                  "Explore All Campus Deals"
                )}
              </h2>
              {isLoading && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Searching...</span>
                </div>
              )}
            </div>

            {/* Results Grid */}
            {items.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 px-4 text-center">
                <PackageOpen className="h-12 w-12 text-muted-foreground/60 mb-3" />
                <h3 className="text-base font-semibold text-foreground">No matching items found</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
                  We couldn't find any listings matching your search criteria. Try adjusting your keywords, campus, or price range.
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetFilters}
                    className="rounded-xl"
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Reset All Filters
                  </Button>
                )}
              </div>
            ) : (
              <div
                className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4"
                style={{ contentVisibility: "auto" }}
              >
                {items.map((item, index) => (
                  <ListingCard
                    key={item.id}
                    listing={item}
                    priority={index < 4}
                  />
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {hasMore && (
              <div className="flex flex-col items-center justify-center pt-6 pb-8">
                <div ref={observerRef} className="h-6 w-full" />
                {isLoadingMore ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Loading more items...</span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="default"
                    onClick={handleLoadMore}
                    className="rounded-xl font-medium px-6 hover:bg-muted"
                  >
                    Load More Results
                  </Button>
                )}
              </div>
            )}

            {!hasMore && items.length > 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground border-t border-border/40">
                End of search results.
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading search results...</p>
        </div>
      }
    >
      <SearchPageContent />
    </React.Suspense>
  );
}
