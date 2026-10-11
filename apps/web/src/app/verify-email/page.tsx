"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { isValidReturnTo, normalizeEmail } from "@downtown/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const rawReturnTo = searchParams.get("returnTo");
  const returnTo = isValidReturnTo(rawReturnTo) ? rawReturnTo! : "/";

  const [email, setEmail] = React.useState(emailParam);
  const [otp, setOtp] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState(60);

  // Countdown timer for resend
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setError("Please enter a valid 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      const res = await (authClient as any).emailOtp.verifyEmail({
        email: normalizeEmail(email),
        otp: cleanOtp,
      });

      if (res.error) {
        setError(res.error.message || "Invalid or expired verification code.");
        setLoading(false);
        return;
      }

      setSuccess("Email successfully verified! Redirecting...");
      setTimeout(() => {
        router.push(returnTo);
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setError("An unexpected error occurred during verification. Please try again.");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setError(null);
    setResending(true);

    try {
      await (authClient as any).emailOtp.sendVerificationOtp({
        email: normalizeEmail(email),
        type: "email-verification",
      });

      setSuccess("A fresh 6-digit code has been sent if this email is registered.");
      setResendCooldown(60);
    } catch (err: any) {
      // Anti-enumeration: do not expose failure
      setSuccess("A fresh 6-digit code has been sent if this email is registered.");
      setResendCooldown(60);
    } finally {
      setResending(false);
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
            Verify Your Email
          </h1>
          <p className="text-xs text-muted-foreground">
            Enter the 6-digit code sent to{" "}
            <span className="font-medium text-foreground">{email || "your email"}</span>
          </p>
        </div>

        {/* Success Alert */}
        {success && (
          <div
            className="rounded-md border border-accent/20 bg-accent/10 p-3 text-xs text-accent flex items-start gap-2"
            role="status"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

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
        <form onSubmit={handleVerify} className="space-y-4">
          {!emailParam && (
            <div className="space-y-1.5">
              <Label htmlFor="email" required>
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="otp" required>
                6-Digit Verification Code
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Expires in 10 mins
              </span>
            </div>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="123456"
              className="text-center tracking-widest text-lg font-mono"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              disabled={loading}
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Maximum 5 attempts allowed per code.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verifying..." : "Verify & Continue"}
          </Button>
        </form>

        {/* Resend Section */}
        <div className="text-center space-y-2 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">Didn&apos;t receive the code?</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResend}
            disabled={resendCooldown > 0 || resending}
            className="w-full gap-2 text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
            <span>
              {resendCooldown > 0
                ? `Resend available in ${resendCooldown}s`
                : "Resend 6-Digit Code"}
            </span>
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </React.Suspense>
  );
}
