"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { ListingForm } from "@/components/listing-form";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { canSell } from "@downtown/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import type { Category, Listing } from "@downtown/types";

const FALLBACK_CATEGORIES: Category[] = [
  { id: "cat_electronics", name: "Electronics", slug: "electronics", displayOrder: 1, isActive: true, createdAt: new Date() },
  { id: "cat_fashion_accessories", name: "Fashion & Accessories", slug: "fashion-accessories", displayOrder: 2, isActive: true, createdAt: new Date() },
  { id: "cat_food_drinks", name: "Food & Drinks", slug: "food-drinks", displayOrder: 3, isActive: true, createdAt: new Date() },
  { id: "cat_home_living", name: "Home & Living", slug: "home-living", displayOrder: 4, isActive: true, createdAt: new Date() },
  { id: "cat_books_study_materials", name: "Books & Study Materials", slug: "books-study-materials", displayOrder: 5, isActive: true, createdAt: new Date() },
  { id: "cat_beauty_personal_care", name: "Beauty & Personal Care", slug: "beauty-personal-care", displayOrder: 6, isActive: true, createdAt: new Date() },
  { id: "cat_services", name: "Services", slug: "services", displayOrder: 7, isActive: true, createdAt: new Date() },
  { id: "cat_tickets_events", name: "Tickets & Events", slug: "tickets-events", displayOrder: 8, isActive: true, createdAt: new Date() },
  { id: "cat_other", name: "Other", slug: "other", displayOrder: 9, isActive: true, createdAt: new Date() },
];

export default function EditListingPage() {
  const params = useParams();
  const listingId = params?.id as string;
  const router = useRouter();

  const { isAuthenticated, isPending, user } = useAuthGate();
  const [categories, setCategories] = React.useState<Category[]>(FALLBACK_CATEGORIES);
  const [listingData, setListingData] = React.useState<Listing | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const isSeller = canSell(user as any);

  React.useEffect(() => {
    async function loadData() {
      if (!listingId) return;
      try {
        setIsLoading(true);
        setError(null);

        const [catsRes, itemRes] = await Promise.all([
          fetch("/api/categories"),
          fetch(`/api/listings/${listingId}`),
        ]);

        if (catsRes.ok) {
          const cats = await catsRes.json();
          if (Array.isArray(cats) && cats.length > 0) setCategories(cats);
        }

        if (!itemRes.ok) {
          const err = await itemRes.json().catch(() => ({}));
          throw new Error(err.message || "Failed to load listing");
        }

        const item = await itemRes.json();
        setListingData(item);
      } catch (err: any) {
        setError(err.message || "Failed to load listing");
      } finally {
        setIsLoading(false);
      }
    }

    if (isAuthenticated) {
      loadData();
    } else if (!isPending) {
      setIsLoading(false);
    }
  }, [listingId, isAuthenticated, isPending]);

  if (isPending || isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/sell" className="hover:text-foreground flex items-center gap-1 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Seller Dashboard
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">Edit Listing</span>
        </div>

        <div className="border-b border-border pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Edit Listing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Update listing details, pricing, condition, or photos.
          </p>
        </div>

        {error ? (
          <div className="p-6 border border-destructive/20 rounded-xl bg-destructive/10 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
            <h2 className="text-base font-semibold text-destructive">{error}</h2>
            <Link href="/sell">
              <Button variant="outline">Return to Dashboard</Button>
            </Link>
          </div>
        ) : listingData ? (
          <ListingForm
            initialData={{
              id: listingData.id,
              title: listingData.title,
              description: listingData.description,
              price: listingData.price,
              isNegotiable: listingData.isNegotiable,
              categoryId: listingData.categoryId,
              condition: (listingData.condition as any) || "",
              locationId: listingData.locationId,
              quantityAvailable: listingData.quantityAvailable,
              photos:
                listingData.photos?.map((p) => ({
                  id: p.id,
                  url: p.url,
                  thumbUrl: p.thumbUrl,
                  width: p.width,
                  height: p.height,
                })) || [],
            }}
            categories={categories}
            isEditing={true}
          />
        ) : null}
      </main>
    </div>
  );
}
