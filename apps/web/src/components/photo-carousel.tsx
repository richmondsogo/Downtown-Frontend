"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ImageOff, Maximize2, X } from "lucide-react";
import type { PublicListingPhoto } from "@downtown/types";
import { cn } from "@downtown/utils";

interface PhotoCarouselProps {
  photos: PublicListingPhoto[];
  title: string;
  className?: string;
}

/**
 * Accessible Photo Carousel for Listing Detail
 * - Mobile swipe gesture support
 * - Desktop thumbnail strip
 * - Fullscreen zoom modal
 * - Explicit aspect ratio and image sizes (0 CLS)
 */
export function PhotoCarousel({ photos, title, className }: PhotoCarouselProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = React.useState(false);
  const touchStartX = React.useRef<number | null>(null);
  const touchEndX = React.useRef<number | null>(null);

  const hasPhotos = photos && photos.length > 0;
  const currentPhoto = hasPhotos ? photos[activeIndex] : null;

  const nextPhoto = React.useCallback(() => {
    if (!hasPhotos) return;
    setActiveIndex((prev) => (prev + 1) % photos.length);
  }, [hasPhotos, photos?.length]);

  const prevPhoto = React.useCallback(() => {
    if (!hasPhotos) return;
    setActiveIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [hasPhotos, photos?.length]);

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 50) {
      nextPhoto();
    } else if (distance < -50) {
      prevPhoto();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevPhoto();
      if (e.key === "ArrowRight") nextPhoto();
      if (e.key === "Escape" && isLightboxOpen) setIsLightboxOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextPhoto, prevPhoto, isLightboxOpen]);

  if (!hasPhotos) {
    return (
      <div
        className={cn(
          "w-full aspect-[4/3] rounded-2xl bg-muted/60 border border-border flex flex-col items-center justify-center text-muted-foreground",
          className
        )}
      >
        <ImageOff className="h-12 w-12 stroke-[1.5] mb-2 opacity-50" />
        <p className="text-sm">No photos provided for this listing</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3 select-none", className)}>
      {/* Main Stage Viewport */}
      <div
        className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-muted border border-border group"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={currentPhoto?.url}
          alt={`${title} - Photo ${activeIndex + 1}`}
          width={800}
          height={600}
          loading={activeIndex === 0 ? "eager" : "lazy"}
          fetchPriority={activeIndex === 0 ? "high" : "auto"}
          className="w-full h-full object-cover transition-opacity duration-300"
        />

        {/* Counter Badge */}
        {photos.length > 1 && (
          <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-background/80 backdrop-blur-md text-foreground border border-border shadow-sm">
            {activeIndex + 1} / {photos.length}
          </span>
        )}

        {/* Expand Lightbox Button */}
        <button
          type="button"
          onClick={() => setIsLightboxOpen(true)}
          aria-label="View full photo"
          className="absolute top-3 right-3 p-2 rounded-full bg-background/80 backdrop-blur-md text-foreground border border-border hover:bg-background transition-colors cursor-pointer shadow-sm"
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        {/* Previous Button */}
        {photos.length > 1 && (
          <button
            type="button"
            onClick={prevPhoto}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-md text-foreground border border-border hover:bg-background transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer shadow-sm"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {/* Next Button */}
        {photos.length > 1 && (
          <button
            type="button"
            onClick={nextPhoto}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-md text-foreground border border-border hover:bg-background transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer shadow-sm"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Thumbnail Strip */}
      {photos.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {photos.map((p, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <button
                key={p.id || idx}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-label={`Select photo ${idx + 1}`}
                className={cn(
                  "relative h-16 w-20 shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer min-h-[44px]",
                  isSelected
                    ? "border-primary ring-2 ring-primary/20 scale-102"
                    : "border-border/70 opacity-70 hover:opacity-100"
                )}
              >
                <img
                  src={p.thumbUrl || p.url}
                  alt={`Thumbnail ${idx + 1}`}
                  width={80}
                  height={64}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {isLightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in-0 duration-150"
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            aria-label="Close photo preview"
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="relative max-w-4xl max-h-[85vh] w-full flex items-center justify-center">
            <img
              src={currentPhoto?.url}
              alt={`${title} - Photo ${activeIndex + 1}`}
              className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
            />

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevPhoto}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={nextPhoto}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>

          <div className="mt-4 text-white/80 text-sm font-medium">
            {activeIndex + 1} of {photos.length}
          </div>
        </div>
      )}
    </div>
  );
}
