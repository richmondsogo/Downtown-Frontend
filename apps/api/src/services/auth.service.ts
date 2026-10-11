import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { db } from "../db/index";
import * as schema from "../db/schema";
import { getEmailService } from "./email.service";
import { SignUpSchema, normalizeMatricNumber } from "@downtown/validation";

const emailService = getEmailService();

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          return {
            data: {
              ...user,
              matricNumber:
                typeof (user as Record<string, unknown>).matricNumber === "string"
                  ? normalizeMatricNumber(
                      (user as Record<string, unknown>).matricNumber as string
                    )
                  : null,
              sellerStatus: "not_a_seller",
              accountStatus: "active",
            },
          };
        },
      },
    },
  },
  secret:
    process.env.BETTER_AUTH_SECRET ||
    "downtown-dev-secret-replace-in-production-12345678901234567890",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://downtown-web-five.vercel.app",
    "https://downtown-api.vercel.app",
    "https://*.vercel.app",
  ],
  advanced: {
    ipAddress: {
      ipAddressHeaders: [
        "x-vercel-forwarded-for",
        "x-real-ip",
        "x-forwarded-for",
      ],
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/email-otp/verify-email": { window: 60, max: 10 },
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "student",
        input: true,
      },
      matricNumber: {
        type: "string",
        required: false,
        input: true,
      },
      sellerStatus: {
        type: "string",
        required: false,
        defaultValue: "not_a_seller",
        input: false,
      },
      accountStatus: {
        type: "string",
        required: false,
        defaultValue: "active",
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignInAfterVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, url }) {
      await emailService.sendPasswordResetEmail(user.email, url);
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600, // 10 minutes
      overrideDefaultEmailVerification: true,
      async sendVerificationOTP({ email, otp }) {
        await emailService.sendVerificationOtp(email, otp);
      },
    }),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const body = ctx.body as Record<string, unknown> | undefined;
        const parsed = SignUpSchema.safeParse(body);
        if (!parsed.success) {
          const firstErr = parsed.error.issues[0]?.message || "Validation failed";
          throw new APIError("BAD_REQUEST", {
            message: firstErr,
          });
        }

        // Production signup flag guard (defaults to disabled in production until domain is configured)
        const isProd =
          process.env.VERCEL_ENV === "production" ||
          process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
        const isSignupDisabled =
          process.env.ENABLE_SIGNUP === "false" ||
          (isProd && process.env.ENABLE_SIGNUP !== "true");

        if (isSignupDisabled) {
          throw new APIError("FORBIDDEN", {
            message:
              "Student registration is currently disabled ahead of MVP launch on November 30, 2026.",
          });
        }

        // Normalize role and matricNumber into request body
        ctx.body = {
          ...body,
          ...parsed.data,
        };
      }
    }),
  },
});
