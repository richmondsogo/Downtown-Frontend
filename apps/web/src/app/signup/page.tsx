"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import {
  SignUpSchema,
  isValidReturnTo,
  normalizeEmail,
  normalizeMatricNumber,
  MATRIC_NUMBER_EXAMPLE,
} from "@downtown/validation";
import type { SignupRole } from "@downtown/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertCircle } from "lucide-react";

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawReturnTo = searchParams.get("returnTo");
  const returnTo = isValidReturnTo(rawReturnTo) ? rawReturnTo! : "/";

  const [role, setRole] = React.useState<SignupRole>("student");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [matricNumber, setMatricNumber] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate payload with SignUpSchema
    const payload =
      role === "student"
        ? {
            role: "student" as const,
            name: name.trim(),
            email: normalizeEmail(email),
            matricNumber: matricNumber.trim(),
            password,
          }
        : role === "staff"
        ? {
            role: "staff" as const,
            name: name.trim(),
            email: normalizeEmail(email),
            password,
          }
        : {
            role: "vendor" as const,
            name: name.trim(),
            email: normalizeEmail(email),
            password,
          };

    const parsed = SignUpSchema.safeParse(payload);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Validation error";
      setError(firstIssue);
      return;
    }

    setLoading(true);

    try {
      const res = await (signUp.email as any)({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        role: parsed.data.role,
        ...(parsed.data.role === "student"
          ? { matricNumber: normalizeMatricNumber(parsed.data.matricNumber) }
          : {}),
      });

      if (res.error) {
        // Anti-enumeration / duplicate email or general error
        setError(
          res.error.message ||
            "Unable to complete registration. If you already have an account, please sign in."
        );
        setLoading(false);
        return;
      }

      // Successful signup triggers email OTP. Redirect to /verify-email
      const verifyUrl = `/verify-email?email=${encodeURIComponent(
        parsed.data.email
      )}&returnTo=${encodeURIComponent(returnTo)}`;
      router.push(verifyUrl);
    } catch (err: any) {
      setError("An unexpected error occurred during signup. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-background">
      <div className="w-full max-w-sm space-y-6">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to marketplace</span>
        </Link>

        {/* Header */}
        <div className="space-y-1 text-center">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-primary text-primary-foreground font-bold mb-2">
            D
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Create an Account
          </h1>
          <p className="text-xs text-muted-foreground">
            Join the verified UNIOSUN campus marketplace
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="flex rounded-md border border-border p-1 bg-muted">
          {(["student", "staff", "vendor"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRole(r);
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-sm capitalize transition-colors min-h-[36px] ${
                role === r
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Error Alert */}
        {error && (
          <div
            className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2"
            role="alert"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" required>
              {role === "vendor" ? "Business or Seller Name" : "Full Name"}
            </Label>
            <Input
              id="name"
              type="text"
              placeholder={role === "vendor" ? "Campus Stores Ltd" : "Adeola Adeleke"}
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" required>
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <p className="text-[11px] text-muted-foreground">
              Use an email you check often. We&apos;ll send a code to it.
            </p>
          </div>

          {role === "student" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="matricNumber" required>
                  Matric Number
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  e.g. {MATRIC_NUMBER_EXAMPLE}
                </span>
              </div>
              <Input
                id="matricNumber"
                type="text"
                placeholder={MATRIC_NUMBER_EXAMPLE}
                autoCapitalize="characters"
                required
                value={matricNumber}
                onChange={(e) => setMatricNumber(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" required>
                Password
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Min 8 characters
              </span>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : `Sign Up as ${role}`}
          </Button>
        </form>

        {/* Footer Link */}
        <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
          Already have an account?{" "}
          <Link
            href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <SignupContent />
    </React.Suspense>
  );
}
