"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  User as UserIcon,
  LogOut,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";

export function Header() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close menu on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setMenuOpen(false);
      router.refresh();
    } catch (err) {
      console.error("Sign out error", err);
    }
  };

  const user = session?.user as
    | {
        name?: string;
        email?: string;
        role?: string;
        sellerStatus?: string;
        matricNumber?: string;
      }
    | undefined;

  return (
    <header className="w-full flex items-center justify-between py-3 border-b border-border bg-background">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-2 group">
        <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm tracking-tight transition-transform group-hover:scale-95">
          D
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-lg tracking-tight text-foreground">
              Downtown
            </span>
            <Badge variant="verified" className="text-[10px] px-1.5 py-0 h-4">
              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
              UNIOSUN
            </Badge>
          </div>
        </div>
      </Link>

      {/* Auth state actions */}
      <div className="flex items-center gap-2">
        {isPending ? (
          <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
        ) : user ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted text-sm font-medium transition-colors min-h-[44px] min-w-[44px]"
              aria-expanded={menuOpen}
              aria-label="User profile menu"
            >
              <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                {user.name?.[0]?.toUpperCase() || "U"}
              </div>
              <span className="max-w-[100px] truncate text-xs sm:text-sm font-medium text-foreground">
                {user.name?.split(" ")[0]}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-md border border-border bg-card p-3 shadow-md z-50 text-left space-y-3">
                <div className="space-y-1 border-b border-border pb-2.5">
                  <div className="font-semibold text-sm text-foreground truncate">
                    {user.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {user.role || "student"}
                    </Badge>
                    {user.sellerStatus === "verified" ? (
                      <Badge variant="verified" className="text-[10px]">
                        Verified Seller
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Buyer
                      </Badge>
                    )}
                  </div>
                  {user.matricNumber && (
                    <div className="text-[11px] text-muted-foreground pt-0.5 font-mono">
                      Matric: {user.matricNumber}
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 h-9"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="h-9 px-3 text-xs sm:text-sm">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="h-9 px-3 text-xs sm:text-sm">
                Sign Up
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
