"use client";

import * as React from "react";
import { cn } from "@downtown/utils";
import {
  Laptop,
  Shirt,
  Utensils,
  Home,
  BookOpen,
  Sparkles,
  Wrench,
  Ticket,
  MoreHorizontal,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
}

const ICON_MAP: Record<string, LucideIcon> = {
  laptop: Laptop,
  shirt: Shirt,
  utensils: Utensils,
  home: Home,
  "book-open": BookOpen,
  sparkles: Sparkles,
  wrench: Wrench,
  ticket: Ticket,
  "more-horizontal": MoreHorizontal,
};

export interface CategoryPillsProps {
  categories: CategoryItem[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
  className?: string;
}

/**
 * Reusable, mobile-first CategoryPills selector.
 * - Horizontally scrollable on mobile (375px) without layout shift.
 * - Accessible tablist with touch targets >= 44px.
 * - Strict adherence to DESIGN.md tokens (no hardcoded colors or spacing).
 */
export function CategoryPills({
  categories,
  selectedSlug,
  onSelect,
  className,
}: CategoryPillsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter by product category"
      className={cn(
        "flex items-center gap-2 overflow-x-auto py-1 scrollbar-none sm:flex-wrap",
        className
      )}
    >
      {/* "All" category pill */}
      <button
        type="button"
        role="tab"
        id="category-pill-all"
        aria-selected={selectedSlug === null}
        onClick={() => onSelect(null)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium shrink-0 transition-colors cursor-pointer select-none min-h-[44px]",
          selectedSlug === null
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
        <span>All</span>
      </button>

      {/* Dynamic categories */}
      {categories.map((cat) => {
        const isSelected = selectedSlug === cat.slug;
        const IconComponent = (cat.icon && ICON_MAP[cat.icon]) || MoreHorizontal;

        return (
          <button
            key={cat.id}
            type="button"
            role="tab"
            id={`category-pill-${cat.slug}`}
            aria-selected={isSelected}
            onClick={() => onSelect(cat.slug)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium shrink-0 transition-colors cursor-pointer select-none min-h-[44px]",
              isSelected
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <IconComponent className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}
