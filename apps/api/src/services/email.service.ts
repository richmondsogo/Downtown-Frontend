export interface EmailService {
  sendVerificationOtp(to: string, otp: string): Promise<void>;
  sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>;
}

/**
 * Development & Preview console email service.
 * Displays verification OTP and password reset links directly in stdout.
 * Strictly throws if attempted in production without preview mode.
 */
export class ConsoleEmailService implements EmailService {
  constructor() {
    const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
    const isVercelProd =
      (process.env.VERCEL_ENV === "production" ||
        process.env.NEXT_PUBLIC_VERCEL_ENV === "production") &&
      !isBuildPhase;

    if (isVercelProd) {
      throw new Error(
        "FATAL: ConsoleEmailService cannot be used in production environment. A real email provider (e.g. Resend) is required."
      );
    }
  }

  async sendVerificationOtp(to: string, otp: string): Promise<void> {
    console.log("=================================================");
    console.log(`[EMAIL SERVICE (CONSOLE)] To: ${to}`);
    console.log(`Subject: Your Downtown Verification Code`);
    console.log(`Your 6-digit verification code is: ${otp}`);
    console.log(`This code expires in 10 minutes.`);
    console.log("=================================================");
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    console.log("=================================================");
    console.log(`[EMAIL SERVICE (CONSOLE)] To: ${to}`);
    console.log(`Subject: Reset your Downtown Password`);
    console.log(`Reset link: ${resetUrl}`);
    console.log(`This link expires in 1 hour.`);
    console.log("=================================================");
  }
}

/**
 * Production Resend email adapter.
 * Uses HTTP fetch to Resend API. Dormant until domain is attached and ENABLE_RESEND_EMAIL=true.
 */
export class ResendEmailService implements EmailService {
  private apiKey: string;
  private from: string;

  constructor(apiKey?: string, from?: string) {
    this.apiKey = apiKey || process.env.RESEND_API_KEY || "";
    this.from = from || process.env.EMAIL_FROM || "Downtown <auth@downtown.ng>";
    if (!this.apiKey) {
      console.warn("[ResendEmailService] RESEND_API_KEY is not configured; adapter is disabled.");
    }
  }

  async sendVerificationOtp(to: string, otp: string): Promise<void> {
    if (!this.apiKey) {
      console.warn("[ResendEmailService] Skipping send: no API key configured.");
      return;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [to],
        subject: "Your Downtown Verification Code",
        html: `<p>Your Downtown verification code is: <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend API error: ${err}`);
    }
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    if (!this.apiKey) {
      console.warn("[ResendEmailService] Skipping send: no API key configured.");
      return;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [to],
        subject: "Reset your Downtown Password",
        html: `<p>Click here to reset your Downtown password: <a href="${resetUrl}">${resetUrl}</a></p>`,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend API error: ${err}`);
    }
  }
}

/**
 * Production email service when real provider is not yet enabled.
 * Strictly avoids logging OTP tokens or reset secrets to stdout.
 */
export class ProductionEmailService implements EmailService {
  async sendVerificationOtp(to: string, _otp: string): Promise<void> {
    const masked = to.replace(/(?<=^.).+(?=@)/, "***");
    console.info(
      `[EMAIL SERVICE (PROD)] Outbound OTP delivery suppressed for ${masked}: domain configuration pending.`
    );
    throw new Error(
      "Outbound verification email is disabled in production pending domain setup. Contact support."
    );
  }

  async sendPasswordResetEmail(to: string, _resetUrl: string): Promise<void> {
    const masked = to.replace(/(?<=^.).+(?=@)/, "***");
    console.info(
      `[EMAIL SERVICE (PROD)] Outbound password reset suppressed for ${masked}: domain configuration pending.`
    );
    throw new Error(
      "Outbound password reset email is disabled in production pending domain setup. Contact support."
    );
  }
}

export function getEmailService(): EmailService {
  if (process.env.RESEND_API_KEY && process.env.ENABLE_RESEND_EMAIL === "true") {
    return new ResendEmailService();
  }
  const isVercelProd =
    process.env.VERCEL_ENV === "production" ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
  if (isVercelProd) {
    return new ProductionEmailService();
  }
  return new ConsoleEmailService();
}

