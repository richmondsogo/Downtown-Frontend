"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@downtown/utils";
import type { SearchSuggestion } from "@downtown/types";

export interface SearchBarProps {
  initialQuery?: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchBar({
  initialQuery = "",
  placeholder = "Search laptops, phones, textbooks, clothes...",
  className,
  autoFocus = false,
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState(initialQuery);
  const [suggestions, setSuggestions] = React.useState<SearchSuggestion[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(-1);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const cacheRef = React.useRef<Map<string, SearchSuggestion[]>>(new Map());

  // Keep internal query synchronized if initialQuery changes
  React.useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // Click outside to close dropdown
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced suggestion fetch (min 2 chars, 250ms debounce, AbortController, client cache, no fetch on load)
  React.useEffect(() => {
    const trimmed = query.trim();

    // Condition: min 2 characters, no request if empty or single char
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      return;
    }

    const normalizedKey = trimmed.toLowerCase();

    // Check client cache first
    if (cacheRef.current.has(normalizedKey)) {
      setSuggestions(cacheRef.current.get(normalizedKey)!);
      setIsOpen(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const timer = setTimeout(async () => {
      // Abort previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error("Failed to fetch suggestions");
        }

        const data = await res.json();
        const items: SearchSuggestion[] = Array.isArray(data)
          ? data.map((item) => (typeof item === "string" ? { title: item } : item))
          : Array.isArray(data.items)
          ? data.items
          : [];
        
        // Cache result in client memory
        cacheRef.current.set(normalizedKey, items);

        setSuggestions(items);
        setIsOpen(items.length > 0);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Suggestion fetch error:", err);
          setSuggestions([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  const handleSubmit = (targetQuery?: string) => {
    const q = (targetQuery !== undefined ? targetQuery : query).trim();
    if (!q) return;
    setIsOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSubmit(suggestions[selectedIndex].title);
      } else {
        handleSubmit();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen && suggestions.length > 0) {
        setIsOpen(true);
      }
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative flex items-center w-full">
        <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-label="Search listings"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            if (suggestions.length > 0 && query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-11 sm:h-12 w-full rounded-2xl border border-input bg-background/80 backdrop-blur-sm pl-10 pr-20 text-sm sm:text-base text-foreground placeholder:text-muted-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary shadow-sm"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-1" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-full transition-colors"
              aria-label="Clear search input"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => handleSubmit()}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            aria-label="Submit search"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Suggestion Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-2 overflow-hidden rounded-2xl border border-border bg-popover/95 backdrop-blur-md p-1.5 shadow-xl transition-all animate-in fade-in-50 slide-in-from-top-1"
        >
          {suggestions.map((item, idx) => (
            <li
              key={`${item.title}-${idx}`}
              role="option"
              aria-selected={idx === selectedIndex}
              onClick={() => handleSubmit(item.title)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={cn(
                "flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-colors",
                idx === selectedIndex
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-foreground hover:bg-accent/60"
              )}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{item.title}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
