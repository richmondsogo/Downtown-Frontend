"use client";

import * as React from "react";
import { cn } from "@downtown/utils";
import {
  MapPin,
  ChevronDown,
  Search,
  Check,
  PlusCircle,
  Building2,
  X,
  AlertCircle,
} from "lucide-react";
import { normalizeLocationName } from "@downtown/validation";

export interface CampusItem {
  id: string;
  name: string;
  slug: string;
}

export interface LocationItem {
  id: string;
  campusId: string;
  name: string;
  slug: string;
  type: string;
  isCurated: boolean;
}

export interface LocationSelectorProps {
  campuses: CampusItem[];
  selectedCampusId: string | null;
  selectedLocation: LocationItem | null;
  onSelectCampus: (campusId: string | null) => void;
  onSelectLocation: (location: LocationItem | null) => void;
  onCreateLocation?: (campusId: string, name: string) => Promise<{ location: LocationItem; isDuplicate: boolean } | null>;
  className?: string;
}

/**
 * Mobile-first LocationSelector combobox component.
 * - Allows campus filtering and search autocomplete.
 * - Touch targets >= 44px.
 * - Supports custom location creation trigger.
 * - Uses strictly design tokens from DESIGN.md.
 */
export function LocationSelector({
  campuses,
  selectedCampusId,
  selectedLocation,
  onSelectCampus,
  onSelectLocation,
  onCreateLocation,
  className,
}: LocationSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [results, setResults] = React.useState<LocationItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch autocomplete results whenever search query or selected campus changes
  React.useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    async function fetchAutocomplete() {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set("q", searchQuery.trim());
        if (selectedCampusId) params.set("campusId", selectedCampusId);

        const res = await fetch(`/api/locations/autocomplete?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load locations");
        const data = await res.json();
        if (!isCancelled) {
          setResults(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!isCancelled) {
          setErrorMsg("Could not load locations. Tap to retry.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    const timer = setTimeout(fetchAutocomplete, 150);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, searchQuery, selectedCampusId]);

  const selectedCampusName =
    campuses.find((c) => c.id === selectedCampusId)?.name || "All Campuses";

  const handleSelectLocation = (loc: LocationItem) => {
    onSelectLocation(loc);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectLocation(null);
  };

  const handleCreateCustom = async () => {
    if (!selectedCampusId) {
      setErrorMsg("Please select a specific campus first.");
      return;
    }
    const normalized = normalizeLocationName(searchQuery);
    if (normalized.length < 3) {
      setErrorMsg("Location name must be at least 3 characters.");
      return;
    }

    if (onCreateLocation) {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const result = await onCreateLocation(selectedCampusId, normalized);
        if (result?.location) {
          onSelectLocation(result.location);
          setIsOpen(false);
          setSearchQuery("");
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to create location");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className={cn("relative w-full space-y-2", className)} ref={dropdownRef}>
      {/* Trigger Bar */}
      <div className="flex items-center gap-2">
        {/* Campus Filter Selector */}
        <div className="relative shrink-0">
          <select
            id="location-selector-campus"
            aria-label="Filter by campus"
            value={selectedCampusId || ""}
            onChange={(e) => onSelectCampus(e.target.value ? e.target.value : null)}
            className="h-[44px] appearance-none pl-3 pr-8 py-2 bg-muted border border-border rounded-md text-xs font-medium text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Campuses</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
        </div>

        {/* Location Combobox Trigger Button */}
        <button
          type="button"
          id="location-selector-trigger"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex-1 flex items-center justify-between h-[44px] px-3 bg-muted border border-border rounded-md text-xs font-medium text-foreground cursor-pointer hover:bg-muted/80 transition-colors"
        >
          <div className="flex items-center gap-2 truncate">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="truncate">
              {selectedLocation ? selectedLocation.name : "Select hostel or area..."}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {selectedLocation && (
              <span
                role="button"
                aria-label="Clear location filter"
                onClick={handleClear}
                className="p-1 hover:bg-muted-foreground/20 rounded-sm cursor-pointer"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
            )}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          </div>
        </button>
      </div>

      {/* Autocomplete Dropdown Popover */}
      {isOpen && (
        <div
          id="location-selector-dropdown"
          className="absolute z-50 left-0 right-0 top-full mt-1 bg-background border border-border rounded-md shadow-sm overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {/* Search Input Bar */}
          <div className="p-2 border-b border-border flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <input
              type="text"
              id="location-selector-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type hostel, campus gate, or student area..."
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[36px]"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Clear query"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-2.5 bg-destructive/10 text-destructive text-xs flex items-center gap-1.5 border-b border-destructive/20">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Results List */}
          <div className="max-h-60 overflow-y-auto p-1 space-y-0.5" role="listbox">
            {isLoading && results.length === 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Loading locations...
              </div>
            )}

            {!isLoading && results.length === 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground space-y-2">
                <p>No verified locations found matching &quot;{searchQuery}&quot;</p>
                {onCreateLocation && selectedCampusId && searchQuery.trim().length >= 3 && (
                  <button
                    type="button"
                    onClick={handleCreateCustom}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md cursor-pointer hover:bg-primary/90"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Add &quot;{normalizeLocationName(searchQuery)}&quot;</span>
                  </button>
                )}
              </div>
            )}

            {results.map((loc) => {
              const isSelected = selectedLocation?.id === loc.id;
              return (
                <button
                  key={loc.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectLocation(loc)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs text-left cursor-pointer transition-colors min-h-[44px]",
                    isSelected
                      ? "bg-muted font-medium text-foreground"
                      : "text-foreground hover:bg-muted/60"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{loc.name}</span>
                    {!loc.isCurated && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                        Custom
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Footer Helper */}
          <div className="px-3 py-2 bg-muted/40 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Filtering in {selectedCampusName}</span>
            <span>Limit 8 curated</span>
          </div>
        </div>
      )}
    </div>
  );
}
