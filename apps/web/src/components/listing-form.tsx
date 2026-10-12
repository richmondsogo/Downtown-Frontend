"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PhotoUploader, UploadedPhoto } from "./photo-uploader";
import {
  LocationSelector,
  type CampusItem,
  type LocationItem,
} from "./location-selector";
import { CategoryPills } from "./category-pills";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  getCategoryConditionRequirement,
  MAX_LISTING_PRICE_NAIRA,
  ListingCondition,
} from "@downtown/validation";
import { formatNaira, cn } from "@downtown/utils";
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Category } from "@downtown/types";

export interface ListingFormData {
  id?: string;
  title: string;
  description: string;
  price: string | number;
  isNegotiable: boolean;
  categoryId: string;
  categorySlug?: string;
  condition?: ListingCondition | "";
  locationId: string;
  quantityAvailable: number;
  photos: UploadedPhoto[];
}

export interface ListingFormProps {
  initialData?: Partial<ListingFormData>;
  categories: Category[];
  isEditing?: boolean;
}

const DEFAULT_CAMPUSES: CampusItem[] = [
  { id: "campus_osogbo", name: "Osogbo (Main Campus)", slug: "osogbo" },
  { id: "campus_ikire", name: "Ikire Campus", slug: "ikire" },
  { id: "campus_okuku", name: "Okuku Campus", slug: "okuku" },
  { id: "campus_ifetedo", name: "Ifetedo Campus", slug: "ifetedo" },
  { id: "campus_ipetu_ijesha", name: "Ipetu-Ijesha Campus", slug: "ipetu-ijesha" },
  { id: "campus_ejigbo", name: "Ejigbo Campus", slug: "ejigbo" },
];

const CONDITIONS: { value: ListingCondition; label: string; desc: string }[] = [
  { value: "new", label: "Brand New", desc: "Never used, in original packaging" },
  { value: "like_new", label: "Like New", desc: "Used briefly, flawless condition" },
  { value: "good", label: "Good", desc: "Normal wear, fully functional" },
  { value: "fair", label: "Fair", desc: "Visible wear, works properly" },
];

export function ListingForm({
  initialData,
  categories,
  isEditing = false,
}: ListingFormProps) {
  const router = useRouter();

  const [campuses, setCampuses] = React.useState<CampusItem[]>(DEFAULT_CAMPUSES);
  const [selectedCampusId, setSelectedCampusId] = React.useState<string | null>("campus_osogbo");
  const [selectedLocation, setSelectedLocation] = React.useState<LocationItem | null>(
    initialData?.locationId
      ? {
          id: initialData.locationId,
          campusId: "campus_osogbo",
          name: "Selected Location",
          slug: "selected-location",
          type: "campus",
          isCurated: true,
        }
      : null
  );

  React.useEffect(() => {
    async function loadCampuses() {
      try {
        const res = await fetch("/api/campuses");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) setCampuses(data);
        }
      } catch (e) {
        console.warn("Could not load campuses:", e);
      }
    }
    loadCampuses();
  }, []);

  const [formData, setFormData] = React.useState<ListingFormData>({
    id: initialData?.id,
    title: initialData?.title || "",
    description: initialData?.description || "",
    price: initialData?.price ? String(initialData.price) : "",
    isNegotiable: initialData?.isNegotiable ?? false,
    categoryId: initialData?.categoryId || (categories[0]?.id || "cat_electronics"),
    categorySlug: initialData?.categorySlug || (categories[0]?.slug || "electronics"),
    condition: initialData?.condition || "good",
    locationId: initialData?.locationId || "",
    quantityAvailable: initialData?.quantityAvailable || 1,
    photos: initialData?.photos || [],
  });

  const [isSavingDraft, setIsSavingDraft] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Derive condition requirement for currently selected category
  const selectedCategory = categories.find((c) => c.id === formData.categoryId);
  const currentCategorySlug = selectedCategory?.slug || formData.categorySlug || "other";
  const conditionRequirement = getCategoryConditionRequirement(currentCategorySlug);

  const parsedPrice = parseInt(String(formData.price).replace(/\D/g, ""), 10) || 0;

  const handleCategorySelect = (slug: string | null) => {
    if (!slug) return;
    const cat = categories.find((c) => c.slug === slug);
    if (!cat) return;
    setFormData((prev) => ({
      ...prev,
      categoryId: cat.id,
      categorySlug: cat.slug,
    }));
  };

  const handleSaveDraft = async () => {
    try {
      setIsSavingDraft(true);
      setErrorMessage(null);

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        price: parsedPrice > 0 ? parsedPrice : null,
        isNegotiable: formData.isNegotiable,
        categoryId: formData.categoryId || null,
        condition: conditionRequirement !== "not_applicable" && formData.condition ? formData.condition : null,
        locationId: formData.locationId || null,
        quantityAvailable: formData.quantityAvailable,
        photoIds: formData.photos.map((p) => p.id),
      };

      let res: Response;
      if (formData.id) {
        // Update existing draft
        res = await fetch(`/api/listings/${formData.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new draft
        res = await fetch("/api/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to save draft");
      }

      const saved = await res.json();
      setFormData((prev) => ({ ...prev, id: saved.id }));
      setSuccessMessage("Draft saved successfully.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save draft");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      if (formData.photos.length === 0) {
        throw new Error("Please add at least one photo before submitting.");
      }
      if (!formData.title.trim() || formData.title.trim().length < 3) {
        throw new Error("Listing title must be at least 3 characters.");
      }
      if (parsedPrice < 1) {
        throw new Error("Please enter a valid price in whole Naira.");
      }
      if (parsedPrice > MAX_LISTING_PRICE_NAIRA) {
        throw new Error(`Price cannot exceed ${formatNaira(MAX_LISTING_PRICE_NAIRA)}.`);
      }
      if (!formData.locationId) {
        throw new Error("Please select your campus or student area location.");
      }
      if (conditionRequirement === "required" && !formData.condition) {
        throw new Error("Please specify the item condition for this category.");
      }

      // Step 1: Ensure listing draft is saved
      let targetListingId = formData.id;
      const draftPayload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        price: parsedPrice,
        isNegotiable: formData.isNegotiable,
        categoryId: formData.categoryId,
        condition: conditionRequirement !== "not_applicable" && formData.condition ? formData.condition : null,
        locationId: formData.locationId,
        quantityAvailable: formData.quantityAvailable,
        photoIds: formData.photos.map((p) => p.id),
      };

      if (!targetListingId) {
        const createRes = await fetch("/api/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftPayload),
        });
        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}));
          throw new Error(err.message || "Failed to create listing draft");
        }
        const created = await createRes.json();
        targetListingId = created.id;
      } else {
        const updateRes = await fetch(`/api/listings/${targetListingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftPayload),
        });
        if (!updateRes.ok) {
          const err = await updateRes.json().catch(() => ({}));
          throw new Error(err.message || "Failed to update listing draft");
        }
      }

      // Step 2: Submit listing for publication / review
      const submitRes = await fetch(`/api/listings/${targetListingId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          price: parsedPrice,
          isNegotiable: formData.isNegotiable,
          categoryId: formData.categoryId,
          condition: conditionRequirement !== "not_applicable" && formData.condition ? formData.condition : null,
          locationId: formData.locationId,
          quantityAvailable: formData.quantityAvailable,
          photoIds: formData.photos.map((p) => p.id),
        }),
      });

      if (!submitRes.ok) {
        const err = await submitRes.json().catch(() => ({}));
        throw new Error(err.message || "Failed to submit listing");
      }

      const result = await submitRes.json();
      router.push(`/sell?submitted=${result.id}&status=${result.status}`);
    } catch (err: any) {
      setErrorMessage(err.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
      {/* Messages */}
      {errorMessage && (
        <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-3 rounded-lg border border-primary/20 bg-primary/10 text-primary text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Photos Uploader */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-4">
        <PhotoUploader
          photos={formData.photos}
          onChange={(newPhotos) =>
            setFormData((prev) => ({ ...prev, photos: newPhotos }))
          }
        />
      </div>

      {/* Category Selection */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3">
        <label className="text-sm font-semibold text-foreground block">
          Category
        </label>
        <CategoryPills
          categories={categories}
          selectedSlug={currentCategorySlug}
          onSelect={handleCategorySelect}
        />
      </div>

      {/* Title & Description */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="listing-title" className="text-sm font-semibold text-foreground">
            Listing Title *
          </label>
          <Input
            id="listing-title"
            placeholder="e.g. iPhone 12 128GB Blue (Clean)"
            value={formData.title}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, title: e.target.value }))
            }
            maxLength={100}
            required
            className="h-11"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Minimum 3 characters</span>
            <span>{formData.title.length}/100</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="listing-desc" className="text-sm font-semibold text-foreground">
            Description
          </label>
          <textarea
            id="listing-desc"
            rows={4}
            placeholder="Describe the condition, features, why you're selling, and what's included..."
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            maxLength={2000}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="flex justify-end text-xs text-muted-foreground">
            <span>{formData.description.length}/2000</span>
          </div>
        </div>
      </div>

      {/* Price & Quantity */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="listing-price" className="text-sm font-semibold text-foreground">
              Price (₦) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                ₦
              </span>
              <Input
                id="listing-price"
                type="text"
                inputMode="numeric"
                placeholder="5,000"
                value={formData.price}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setFormData((prev) => ({ ...prev, price: raw }));
                }}
                className="pl-8 h-11"
                required
              />
            </div>
            {parsedPrice > 0 && (
              <p className="text-xs text-primary font-medium">
                {formatNaira(parsedPrice)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="listing-qty" className="text-sm font-semibold text-foreground">
              Quantity Available
            </label>
            <Input
              id="listing-qty"
              type="number"
              min={1}
              max={999}
              value={formData.quantityAvailable}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  quantityAvailable: Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 1)),
                }))
              }
              className="h-11"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="listing-negotiable"
            checked={formData.isNegotiable}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, isNegotiable: e.target.checked }))
            }
            className="h-4 w-4 rounded-sm border-input text-primary focus:ring-primary"
          />
          <label htmlFor="listing-negotiable" className="text-sm text-foreground select-none">
            Price is negotiable
          </label>
        </div>
      </div>

      {/* Condition (Dynamic per category) */}
      {conditionRequirement !== "not_applicable" && (
        <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-foreground">
              Condition {conditionRequirement === "required" ? "*" : "(Optional)"}
            </label>
            <span className="text-xs text-muted-foreground capitalize">
              {conditionRequirement} for {selectedCategory?.name || "this category"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CONDITIONS.map((cond) => {
              const isSelected = formData.condition === cond.value;
              return (
                <button
                  type="button"
                  key={cond.value}
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      condition: isSelected && conditionRequirement === "optional" ? "" : cond.value,
                    }))
                  }
                  className={cn(
                    "p-3 rounded-lg border text-left transition-colors flex flex-col gap-1",
                    isSelected
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                      : "border-border bg-card hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  <span className="text-xs font-semibold text-foreground">
                    {cond.label}
                  </span>
                  <span className="text-[10px] leading-tight">
                    {cond.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Location Selector */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3">
        <label className="text-sm font-semibold text-foreground block">
          Meeting Location *
        </label>
        <LocationSelector
          campuses={campuses}
          selectedCampusId={selectedCampusId}
          selectedLocation={selectedLocation}
          onSelectCampus={(campId) => setSelectedCampusId(campId)}
          onSelectLocation={(loc: LocationItem | null) => {
            setSelectedLocation(loc);
            setFormData((prev) => ({ ...prev, locationId: loc?.id || "" }));
          }}
          onCreateLocation={async (campId, name) => {
            const res = await fetch("/api/locations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ campusId: campId, name }),
            });
            if (res.ok) {
              return await res.json();
            }
            return null;
          }}
        />
      </div>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={handleSaveDraft}
          disabled={isSavingDraft || isSubmitting}
          className="h-11 px-5"
        >
          {isSavingDraft ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            "Save Draft"
          )}
        </Button>

        <div className="flex gap-2">
          <Link href="/sell">
            <Button type="button" variant="ghost" className="h-11">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={isSubmitting || isSavingDraft}
            className="h-11 px-6 font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Publishing...
              </>
            ) : isEditing ? (
              "Update Listing"
            ) : (
              "Publish Listing"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
