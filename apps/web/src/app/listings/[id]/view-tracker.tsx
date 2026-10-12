"use client";

import * as React from "react";

interface ViewTrackerProps {
  listingId: string;
}

/**
 * Client component that triggers a cheap atomic view count increment
 * using fire-and-forget transport (navigator.sendBeacon or fetch with keepalive: true).
 * Never blocks rendering or page lifecycle.
 */
export function ViewTracker({ listingId }: ViewTrackerProps) {
  React.useEffect(() => {
    const url = `/api/listings/${listingId}/view`;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const sent = navigator.sendBeacon(url);
        if (sent) return;
      }
      fetch(url, { method: "POST", keepalive: true }).catch(() => {});
    } catch {
      // Fire-and-forget transport; never throw or block
    }
  }, [listingId]);

  return null;
}
