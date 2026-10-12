import * as React from "react";
import { Header } from "@/components/header";
import { SearchBar } from "@/components/search-bar";
import { HomeFeed } from "@/components/home-feed";
import { type CategoryItem } from "@/components/category-pills";
import { getApiBaseUrl } from "@/lib/api";
import type { SearchResultPage } from "@downtown/types";
import { ShieldCheck, Sparkles } from "lucide-react";

export const revalidate = 60; // Revalidate at most every 60 seconds

const CATEGORIES: CategoryItem[] = [
  { id: "cat_electronics", name: "Electronics", slug: "electronics", icon: "laptop" },
  { id: "cat_fashion_accessories", name: "Fashion & Accessories", slug: "fashion-accessories", icon: "shirt" },
  { id: "cat_home_living", name: "Home & Living", slug: "home-living", icon: "home" },
  { id: "cat_books_study_materials", name: "Books & Study Materials", slug: "books-study-materials", icon: "book-open" },
  { id: "cat_food_drinks", name: "Food & Drinks", slug: "food-drinks", icon: "utensils" },
  { id: "cat_beauty_personal_care", name: "Beauty & Personal Care", slug: "beauty-personal-care", icon: "sparkles" },
  { id: "cat_services", name: "Services", slug: "services", icon: "wrench" },
  { id: "cat_tickets_events", name: "Tickets & Events", slug: "tickets-events", icon: "ticket" },
  { id: "cat_other", name: "Other", slug: "other", icon: "more-horizontal" },
];

/**
 * Executes exactly ONE server-side fetch for the initial feed page.
 */
async function getInitialFeed(): Promise<SearchResultPage> {
  const apiBaseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${apiBaseUrl}/api/listings?limit=16`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      console.error(`Feed SSR fetch returned status ${res.status}`);
      return { items: [], nextCursor: null, hasMore: false };
    }
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch initial feed SSR:", err);
    return { items: [], nextCursor: null, hasMore: false };
  }
}

export default async function HomePage() {
  const initialFeed = await getInitialFeed();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Top App Header */}
        <Header />

        {/* Hero Section */}
        <section className="py-6 sm:py-8 space-y-4 max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted/60 text-xs text-muted-foreground font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Verified UNIOSUN Student Marketplace</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
            Buy, sell, and discover verified deals across campus.
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Connect directly with verified students and vendors across Osogbo, Ikire, Okuku, Ifetedo, Ipetu-Ijesha, and Ejigbo.
          </p>

          {/* Prominent Search Bar */}
          <div className="pt-2 max-w-xl mx-auto">
            <SearchBar />
          </div>
        </section>

        {/* Discovery Feed */}
        <main className="mt-4 sm:mt-6">
          <HomeFeed
            categories={CATEGORIES}
            initialListings={initialFeed.items}
            initialNextCursor={initialFeed.nextCursor}
            initialHasMore={initialFeed.hasMore}
          />
        </main>
      </div>
    </div>
  );
}
