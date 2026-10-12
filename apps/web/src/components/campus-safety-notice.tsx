import * as React from "react";
import { ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";
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
        <h4>Campus Safety Notice</h4>
      </div>

      <ul className="mt-3 space-y-2 text-xs sm:text-sm text-muted-foreground">
        <li className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>
            <strong>Meet in broad daylight:</strong> Choose busy campus public areas such as the Campus Gate, Central Cafeteria, or Student Union Building (SUB).
          </span>
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>
            <strong>Inspect before you pay:</strong> Test electronic gadgets, try on apparel, and verify textbook editions in person before transferring funds.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <span>
            <strong>No upfront transfer fees:</strong> Downtown and legitimate student sellers will never demand advance reservation or dispatch payments.
          </span>
        </li>
      </ul>
    </div>
  );
}
