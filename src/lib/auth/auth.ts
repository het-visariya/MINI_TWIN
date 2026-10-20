import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";

import { checkAge } from "@/lib/auth/age";
import { DOB_COOKIE, unsign } from "@/lib/auth/signed-cookie";

import { getPrisma } from "@/lib/db";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/email/mailjet";

/**
 * Better Auth, built on first use.
 *
 * Lazy for the same reason the Prisma client is: constructing it reads
 * DATABASE_URL and BETTER_AUTH_SECRET, and `next build` evaluates modules for
 * routes — the landing page and demo mode — that never authenticate anything.
 */
let instance: ReturnType<typeof create> | undefined;

function create() {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is not set. Generate one with: openssl rand -base64 32",
    );
  }

  const google =
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined;

  return betterAuth({
    secret,
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

    database: prismaAdapter(getPrisma(), { provider: "postgresql" }),

    emailAndPassword: {
      enabled: true,
      /* Sign-in is refused until the address is confirmed. */
      requireEmailVerification: true,
      minPasswordLength: 10,
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordResetEmail(user.email, user.name || user.email, url);
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await sendVerificationEmail(user.email, user.name || user.email, url);
      },
    },

    ...(google ? { socialProviders: google } : {}),

    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },

    /*
     * Rate limits. The defaults are generous for reads; these are the
     * endpoints where an unlimited retry is the attack: credential stuffing on
     * sign-in, and using password reset or signup as an email bomb.
     */
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 300, max: 5 },
        "/forget-password": { window: 300, max: 3 },
        "/reset-password": { window: 300, max: 5 },
        "/send-verification-email": { window: 300, max: 3 },
      },
    },

    advanced: {
      cookiePrefix: "dt",
    },

    /*
     * The age gate, enforced at the point of creation.
     *
     * The signup form calls our own `createAccount` action, which checks the
     * gate — but `/api/auth/[...all]` also exposes Better Auth's own
     * `/sign-up/email` and the Google callback, and a POST straight to those
     * would skip the action entirely. So the check lives here as well, where
     * every path that can create a user has to pass through it.
     *
     * It fails closed: no readable, valid date-of-birth cookie means no user.
     */
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const verdict = await ageGateVerdict();

            if (verdict !== "allowed") {
              throw new APIError("BAD_REQUEST", {
                message:
                  verdict === "blocked"
                    ? "This account cannot be created."
                    : "Start again from your date of birth — that step has expired.",
              });
            }

            return { data: user };
          },
        },
      },
    },
  });
}

/**
 * Reads the gate's signed cookie. Returns "missing" rather than throwing when
 * there is no request context to read, so the caller fails closed either way.
 */
async function ageGateVerdict(): Promise<"allowed" | "blocked" | "missing"> {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const value = unsign(store.get(DOB_COOKIE)?.value);

    if (!value) return "missing";
    return checkAge(value).outcome === "allowed" ? "allowed" : "blocked";
  } catch {
    return "missing";
  }
}

export function getAuth() {
  instance ??= create();
  return instance;
}

/** True when Google sign-in is configured; the button is hidden otherwise. */
export function googleEnabled() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
