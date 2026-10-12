"use client";

import * as React from "react";

interface ViewTrackerProps {
  listingId: string;
}

/**
 * Client component that triggers a cheap, debounced atomic view count increment
 * on initial page visit.
 */
export function ViewTracker({ listingId }: ViewTrackerProps) {
  React.useEffect(() => {
    fetch(`/api/listings/${listingId}/view`, { method: "POST" }).catch(() => {});
  }, [listingId]);

  return null;
}
