import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { auth } from "../services/auth.service";
import { db } from "../db/index";
import { user } from "../db/schema";
import { eq } from "drizzle-orm";

describe("Anti-Enumeration Comprehensive Test Suite", () => {
  const uniqueId = Date.now().toString();
  const knownEmail = `enum_known_${uniqueId}@example.com`;
  const unknownEmail = `enum_unknown_${uniqueId}@example.com`;
  const newEmail = `enum_new_${uniqueId}@example.com`;
  const validPassword = "Password123!@#";
  const wrongPassword = "WrongPassword999!";

  let knownUserId: string;

  beforeAll(async () => {
    // Enable signup for tests
    process.env.ENABLE_SIGNUP = "true";

    // 1. Create a known, verified user
    const signUpReq = new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vercel-forwarded-for": `10.50.1.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        name: "Known User",
        email: knownEmail,
        password: validPassword,
        role: "student",
        matricNumber: "2024/11223",
      }),
    });
    const signUpRes = await auth.handler(signUpReq);
    expect([200, 201]).toContain(signUpRes.status);

    const [created] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, knownEmail))
      .limit(1);
    knownUserId = created.id;

    // Verify email
    await db.update(user).set({ emailVerified: true }).where(eq(user.id, knownUserId));
  });

  afterAll(async () => {
    if (knownUserId) {
      await db.delete(user).where(eq(user.id, knownUserId));
    }
    await db.delete(user).where(eq(user.email, newEmail));
  });

  it("1. Login: compares status AND body for unknown email vs wrong password on known email", async () => {
    // A: Wrong password on known user
    const reqKnown = new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        "x-vercel-forwarded-for": `10.50.2.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        email: knownEmail,
        password: wrongPassword,
      }),
    });
    const resKnown = await auth.handler(reqKnown);
    const bodyKnown = await resKnown.json();

    // B: Unknown email
    const reqUnknown = new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        "x-vercel-forwarded-for": `10.50.2.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        email: unknownEmail,
        password: wrongPassword,
      }),
    });
    const resUnknown = await auth.handler(reqUnknown);
    const bodyUnknown = await resUnknown.json();

    console.log("LOGIN Known:", resKnown.status, bodyKnown);
    console.log("LOGIN Unknown:", resUnknown.status, bodyUnknown);

    expect(resKnown.status).toBe(resUnknown.status);
    expect(bodyKnown.message).toBe(bodyUnknown.message);
    expect(bodyKnown.code).toBe(bodyUnknown.code);
  });

  it("2. Password Reset: compares status AND body for known vs unknown email", async () => {
    // A: Known user
    const reqKnown = new Request("http://localhost:3000/api/auth/request-password-reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        "x-vercel-forwarded-for": `10.50.3.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        email: knownEmail,
        redirectTo: "/reset-password",
      }),
    });
    const resKnown = await auth.handler(reqKnown);
    const bodyKnown = await resKnown.json().catch(() => null);

    // B: Unknown user
    const reqUnknown = new Request("http://localhost:3000/api/auth/request-password-reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        "x-vercel-forwarded-for": `10.50.3.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        email: unknownEmail,
        redirectTo: "/reset-password",
      }),
    });
    const resUnknown = await auth.handler(reqUnknown);
    const bodyUnknown = await resUnknown.json().catch(() => null);

    console.log("PASSWORD RESET Known:", resKnown.status, bodyKnown);
    console.log("PASSWORD RESET Unknown:", resUnknown.status, bodyUnknown);

    expect(resKnown.status).toBe(resUnknown.status);
    expect(bodyKnown).toEqual(bodyUnknown);
  });

  it("3. OTP Resend: compares status AND body for known vs unknown email", async () => {
    // A: Known user
    const reqKnown = new Request("http://localhost:3000/api/auth/email-otp/send-verification-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        "x-vercel-forwarded-for": `10.50.4.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        email: knownEmail,
        type: "sign-in",
      }),
    });
    const resKnown = await auth.handler(reqKnown);
    const bodyKnown = await resKnown.json().catch(() => null);

    // B: Unknown user
    const reqUnknown = new Request("http://localhost:3000/api/auth/email-otp/send-verification-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        "x-vercel-forwarded-for": `10.50.4.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        email: unknownEmail,
        type: "sign-in",
      }),
    });
    const resUnknown = await auth.handler(reqUnknown);
    const bodyUnknown = await resUnknown.json().catch(() => null);

    console.log("OTP RESEND Known:", resKnown.status, bodyKnown);
    console.log("OTP RESEND Unknown:", resUnknown.status, bodyUnknown);

    expect(resKnown.status).toBe(resUnknown.status);
    expect(bodyKnown).toEqual(bodyUnknown);
  });

  it("4. Signup: compares status AND body for existing vs new email", async () => {
    // A: Existing email
    const reqExisting = new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        "x-vercel-forwarded-for": `10.50.5.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        name: "Existing Person",
        email: knownEmail,
        password: validPassword,
        role: "student",
        matricNumber: "2024/99887",
      }),
    });
    const resExisting = await auth.handler(reqExisting);
    const bodyExisting = await resExisting.json().catch(() => null);

    // B: Brand new email
    const reqNew = new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        "x-vercel-forwarded-for": `10.50.5.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        name: "New Person",
        email: newEmail,
        password: validPassword,
        role: "student",
        matricNumber: "2024/55443",
      }),
    });
    const resNew = await auth.handler(reqNew);
    const bodyNew = await resNew.json().catch(() => null);

    console.log("SIGNUP Existing:", resExisting.status, bodyExisting);
    console.log("SIGNUP New:", resNew.status, bodyNew);

    expect(resExisting.status).toBe(resNew.status);
    expect(bodyExisting?.message).toBe(bodyNew?.message);
  });
});
