import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth.service";
import { canSell } from "@downtown/utils";
import type { SellerStatus, AccountStatus, Role } from "@downtown/types";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: Role;
  sellerStatus: SellerStatus;
  accountStatus: AccountStatus;
}

export interface AuthSuccess {
  user: AuthenticatedUser;
  errorResponse?: undefined;
}

export interface AuthFailure {
  user?: undefined;
  errorResponse: NextResponse;
}

export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Enforces authentication and authorization for listing endpoints:
 * 1. Active session required (401)
 * 2. Email must be verified (403)
 * 3. Account status must be active (403)
 * 4. For mutations, canSell(user) must return true (sellerStatus strictly "verified") (403)
 */
export async function authorizeUser(
  req: NextRequest,
  options: { requireCanSell?: boolean } = {}
): Promise<AuthResult> {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user?.id) {
    return {
      errorResponse: NextResponse.json(
        { message: "Authentication required to access this resource." },
        { status: 401 }
      ),
    };
  }

  const rawUser = session.user as Record<string, unknown>;
  const user: AuthenticatedUser = {
    id: String(rawUser.id),
    name: String(rawUser.name || ""),
    email: String(rawUser.email || ""),
    emailVerified: Boolean(rawUser.emailVerified),
    role: (rawUser.role as Role) || "student",
    sellerStatus: (rawUser.sellerStatus as SellerStatus) || "not_a_seller",
    accountStatus: (rawUser.accountStatus as AccountStatus) || "active",
  };

  if (!user.emailVerified) {
    return {
      errorResponse: NextResponse.json(
        { message: "Your email must be verified before performing this action." },
        { status: 403 }
      ),
    };
  }

  if (user.accountStatus !== "active") {
    return {
      errorResponse: NextResponse.json(
        { message: `Your account is ${user.accountStatus}. Please contact support.` },
        { status: 403 }
      ),
    };
  }

  if (options.requireCanSell && !canSell(user)) {
    return {
      errorResponse: NextResponse.json(
        {
          message:
            "Verified seller status is required to create or modify listings. Please register or verify your seller account.",
        },
        { status: 403 }
      ),
    };
  }

  return { user };
}
