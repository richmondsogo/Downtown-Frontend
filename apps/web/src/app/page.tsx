"use client";

import * as React from "react";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuthGateModal } from "@/components/auth-gate-modal";
import { CategoryPills, type CategoryItem } from "@/components/category-pills";
import {
  LocationSelector,
  type CampusItem,
  type LocationItem,
} from "@/components/location-selector";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { formatNaira } from "@downtown/utils";
import {
  CheckCircle2,
  ShieldCheck,
  ShoppingBag,
  ArrowRight,
} from "lucide-react";

const INITIAL_CATEGORIES: CategoryItem[] = [
  { id: "cat_electronics", name: "Electronics", slug: "electronics", icon: "laptop" },
  { id: "cat_fashion_accessories", name: "Fashion & Accessories", slug: "fashion-accessories", icon: "shirt" },
  { id: "cat_food_drinks", name: "Food & Drinks", slug: "food-drinks", icon: "utensils" },
  { id: "cat_home_living", name: "Home & Living", slug: "home-living", icon: "home" },
  { id: "cat_books_study_materials", name: "Books & Study Materials", slug: "books-study-materials", icon: "book-open" },
  { id: "cat_beauty_personal_care", name: "Beauty & Personal Care", slug: "beauty-personal-care", icon: "sparkles" },
  { id: "cat_services", name: "Services", slug: "services", icon: "wrench" },
  { id: "cat_tickets_events", name: "Tickets & Events", slug: "tickets-events", icon: "ticket" },
  { id: "cat_other", name: "Other", slug: "other", icon: "more-horizontal" },
];

const INITIAL_CAMPUSES: CampusItem[] = [
  { id: "campus_osogbo", name: "Osogbo (Main Campus)", slug: "osogbo" },
  { id: "campus_ikire", name: "Ikire Campus", slug: "ikire" },
  { id: "campus_okuku", name: "Okuku Campus", slug: "okuku" },
  { id: "campus_ifetedo", name: "Ifetedo Campus", slug: "ifetedo" },
  { id: "campus_ipetu_ijesha", name: "Ipetu-Ijesha Campus", slug: "ipetu-ijesha" },
  { id: "campus_ejigbo", name: "Ejigbo Campus", slug: "ejigbo" },
];

export default function HomePage() {
  const { requireAuth, isModalOpen, closeModal, gateContext, isAuthenticated, user } =
    useAuthGate();
  const [contactSuccess, setContactSuccess] = React.useState(false);

  // Taxonomy & Location state
  const [categories, setCategories] = React.useState<CategoryItem[]>(INITIAL_CATEGORIES);
  const [campuses, setCampuses] = React.useState<CampusItem[]>(INITIAL_CAMPUSES);
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [selectedCampusId, setSelectedCampusId] = React.useState<string | null>("campus_osogbo");
  const [selectedLocation, setSelectedLocation] = React.useState<LocationItem | null>(null);

  // Hydrate categories and campuses from endpoints
  React.useEffect(() => {
    async function loadTaxonomy() {
      try {
        const [catsRes, campsRes] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/campuses"),
        ]);
        if (catsRes.ok) {
          const data = await catsRes.json();
          if (Array.isArray(data) && data.length > 0) setCategories(data);
        }
        if (campsRes.ok) {
          const data = await campsRes.json();
          if (Array.isArray(data) && data.length > 0) setCampuses(data);
        }
      } catch {
        // Fallback to initial seeds
      }
    }
    loadTaxonomy();
  }, []);

  const handleContactSeller = () => {
    requireAuth(
      () => {
        // Authenticated action executed
        setContactSuccess(true);
        setTimeout(() => setContactSuccess(false), 5000);
      },
      {
        title: "Sign in to contact seller",
        description:
          "Downtown connects students directly with verified sellers. Please sign in or create an account to initiate deals.",
        returnTo: "/",
      }
    );
  };

  const handleCreateCustomLocation = async (campusId: string, name: string) => {
    let createdLocation: LocationItem | null = null;
    requireAuth(
      async () => {
        const res = await fetch("/api/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campusId, name }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to create custom location");
        }
        const data = await res.json();
        createdLocation = data.location;
      },
      {
        title: "Sign in to add location",
        description:
          "Adding a custom hostel or landmark requires an authenticated student account.",
        returnTo: "/",
      }
    );
    if (createdLocation) {
      return { location: createdLocation, isDuplicate: false };
    }
    return null;
  };

  const selectedCampusName =
    campuses.find((c) => c.id === selectedCampusId)?.name || "All Campuses";

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 sm:p-8 max-w-lg mx-auto bg-background">
      {/* Top Header with Guest / Authenticated profile state */}
      <Header />

      {/* Hero / Orientation */}
      <section className="w-full my-6 space-y-3 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm border border-border bg-muted text-xs text-muted-foreground font-medium">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" />
          <span>Trust-anchored campus commerce</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Buy and sell safely across campus.
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Downtown replaces chaotic WhatsApp status sales with verified student
          identities, listing moderation, and structured deals.
        </p>
      </section>

      {/* Exploration Controls: LocationSelector & CategoryPills */}
      <section className="w-full space-y-3 mb-6" aria-label="Marketplace exploration filters">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Location & Campus
          </label>
          <LocationSelector
            campuses={campuses}
            selectedCampusId={selectedCampusId}
            selectedLocation={selectedLocation}
            onSelectCampus={(cId) => {
              setSelectedCampusId(cId);
              setSelectedLocation(null);
            }}
            onSelectLocation={setSelectedLocation}
            onCreateLocation={handleCreateCustomLocation}
          />
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Categories
            </span>
            {selectedCategory && (
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline"
              >
                Reset
              </button>
            )}
          </div>
          <CategoryPills
            categories={categories}
            selectedSlug={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>
      </section>

      {/* Mobile-First Card Preview with Active Filtering Feedback */}
      <section className="w-full space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {selectedCategory ? `${categories.find((c) => c.slug === selectedCategory)?.name || "Category"} Listings` : "All Listings"}
          </span>
          {isAuthenticated && (
            <span className="text-xs text-accent font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Signed in as {user?.name?.split(" ")[0]}
            </span>
          )}
        </div>

        {contactSuccess && (
          <div
            className="rounded-md border border-accent/20 bg-accent/10 p-3 text-xs text-accent flex items-start gap-2"
            role="status"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Soft-gate passed! Verified user session active. WhatsApp deal thread ready.
            </span>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-none">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Badge variant="verified" className="text-[10px] px-1.5 py-0">
                  Verified Student
                </Badge>
                <span>·</span>
                <span>{selectedLocation?.name || selectedCampusName}</span>
              </div>
              <h2 className="font-semibold text-base text-foreground leading-snug">
                MacBook Air M1 (8GB / 256GB) Space Grey
              </h2>
            </div>
          </div>
          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <div>
              <span className="text-xs text-muted-foreground">Price</span>
              <div className="text-lg font-bold text-foreground">
                {formatNaira(480000)}
              </div>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleContactSeller}
              id="contact-seller-button"
            >
              <span>Contact Seller</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Bottom Actions */}
      <footer className="w-full mt-10 pt-4 border-t border-border flex flex-col gap-2.5">
        <Button variant="default" className="w-full gap-2">
          <ShoppingBag className="h-4 w-4" />
          <span>Browse Campus Listings</span>
        </Button>
        <p className="text-[11px] text-center text-muted-foreground">
          Downtown Campus Commerce · Verified Student Marketplace
        </p>
      </footer>

      {/* Auth Soft-Gate Modal */}
      <AuthGateModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={gateContext.title}
        description={gateContext.description}
        returnTo={gateContext.returnTo}
      />
    </main>
  );
}
