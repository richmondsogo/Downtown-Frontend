"use client";

import * as React from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth-client";
import { normalizeEmail } from "@downtown/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await requestPasswordReset({
        email: normalizeEmail(email),
        redirectTo: "/reset-password",
      });

      // Anti-enumeration: always display positive confirmation
      setSubmitted(true);
    } catch (err: any) {
      // Still show submitted to prevent enumeration
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-background">
      <div className="w-full max-w-sm space-y-6">
        {/* Back Link */}
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to sign in</span>
        </Link>

        {/* Header */}
        <div className="space-y-1 text-center">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-primary text-primary-foreground font-bold mb-2">
            D
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Reset Password
          </h1>
          <p className="text-xs text-muted-foreground">
            We will send a password reset link to your email address
          </p>
        </div>

        {submitted ? (
          <div className="rounded-md border border-border bg-card p-4 space-y-3 text-center">
            <div className="h-10 w-10 rounded-full bg-accent/10 text-accent mx-auto flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-foreground">
                Check your inbox
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If an account exists for{" "}
                <span className="font-medium text-foreground">{email}</span>, you
                will receive instructions to reset your password.
              </p>
            </div>
            <div className="pt-2">
              <Link href="/login">
                <Button variant="outline" size="sm" className="w-full text-xs h-9">
                  Return to sign in
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2"
                role="alert"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

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
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending link..." : "Send Reset Link"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
