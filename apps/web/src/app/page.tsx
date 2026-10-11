import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@downtown/utils";
import { CheckCircle2, ShieldCheck, ShoppingBag, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 sm:p-8 max-w-lg mx-auto">
      {/* Top Header */}
      <header className="w-full flex items-center justify-between py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            D
          </div>
          <span className="font-semibold text-lg tracking-tight">Downtown</span>
        </div>
        <Badge variant="verified" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          UNIOSUN
        </Badge>
      </header>

      {/* Hero / Orientation */}
      <section className="w-full my-8 space-y-4 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm border border-border bg-muted text-xs text-muted-foreground font-medium">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" />
          Trust-anchored campus commerce
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Buy and sell safely across campus.
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Downtown replaces chaotic WhatsApp status sales with verified student
          identities, listing moderation, and structured deals.
        </p>
      </section>

      {/* Sample Mobile-First Card Preview per DESIGN.md */}
      <section className="w-full space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Marketplace Preview
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-none">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Badge variant="verified" className="text-[10px] px-1.5 py-0">
                  Verified Student
                </Badge>
                <span>·</span>
                <span>Osogbo Campus</span>
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
            <Button size="sm" className="gap-1.5">
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
          November 30, 2026 MVP Launch · Monorepo Scaffold Stage
        </p>
      </footer>
    </main>
  );
}
