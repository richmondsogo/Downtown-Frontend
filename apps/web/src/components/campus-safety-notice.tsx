import { ShieldAlert } from "lucide-react";
import { cn } from "@downtown/utils";

interface CampusSafetyNoticeProps {
  className?: string;
}

/**
 * CampusSafetyNotice Component
 * Actionable safety tips tailored for UNIOSUN university campus trading.
 */
export function CampusSafetyNotice({ className }: CampusSafetyNoticeProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5 text-foreground",
        className
      )}
    >
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-sm sm:text-base">
        <ShieldAlert className="h-5 w-5 shrink-0" />
        <h4>Safety Notice</h4>
      </div>

      <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
        Meet in a public, familiar location and avoid sending money before you&apos;ve verified the item and seller.
      </p>
    </div>
  );
}
