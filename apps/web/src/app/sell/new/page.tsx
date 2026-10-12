"use client";

import * as React from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { ListingForm } from "@/components/listing-form";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { canSell } from "@downtown/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Store } from "lucide-react";
import type { Category } from "@downtown/types";

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

export default function NewListingPage() {
  const { isAuthenticated, isPending, user } = useAuthGate();
  const [categories, setCategories] = React.useState<Category[]>(FALLBACK_CATEGORIES);
  const [isLoadingCategories, setIsLoadingCategories] = React.useState(true);

  const isSeller = canSell(user as any);

  React.useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch("/api/categories");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setCategories(data);
          }
        }
      } catch (e) {
        console.warn("Failed to load categories, using fallback:", e);
      } finally {
        setIsLoadingCategories(false);
      }
    }
    loadCategories();
  }, []);

  if (isPending || isLoadingCategories) {
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
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/sell" className="hover:text-foreground flex items-center gap-1 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Seller Dashboard
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">New Listing</span>
        </div>

        {/* Page Title */}
        <div className="border-b border-border pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Create a New Listing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fill in the details below to list your item for students on campus.
          </p>
        </div>

        {!isAuthenticated ? (
          <div className="p-8 border border-border rounded-xl bg-card text-center space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Sign in required</h2>
            <p className="text-sm text-muted-foreground">
              You must be logged in to create listings.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Link href="/login?returnTo=/sell/new">
                <Button>Sign In</Button>
              </Link>
              <Link href="/signup?returnTo=/sell/new">
                <Button variant="outline">Sign Up</Button>
              </Link>
            </div>
          </div>
        ) : !isSeller ? (
          <div className="p-8 border border-border rounded-xl bg-card text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
              <Store className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Seller Verification Required</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Only verified student or vendor sellers can list items for sale.
            </p>
            <Link href="/sell">
              <Button variant="outline">Return to Dashboard</Button>
            </Link>
          </div>
        ) : (
          <ListingForm categories={categories} />
        )}
      </main>
    </div>
  );
}
