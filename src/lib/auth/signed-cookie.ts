import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal signed-cookie helper for the two pieces of state that exist before
 * (or without) a session: the verified date of birth between the age gate and
 * account creation, and the demo flag.
 *
 * Neither is secret, but both must be tamper-proof — an unsigned `dob` cookie
 * would make the age gate a suggestion, and an unsigned `demo` cookie would
 * let anyone put the app into a mode that bypasses the database.
 */

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;

  if (!value || value.length < 16) {
    throw new Error(
      "BETTER_AUTH_SECRET is missing or too short (needs 16+ characters). Generate one with: openssl rand -base64 32",
    );
  }

  return value;
}

function digest(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function sign(value: string): string {
  return `${Buffer.from(value, "utf8").toString("base64url")}.${digest(value)}`;
}

export function unsign(signed: string | undefined): string | null {
  if (!signed) return null;

  const separator = signed.lastIndexOf(".");
  if (separator <= 0) return null;

  const encoded = signed.slice(0, separator);
  const provided = signed.slice(separator + 1);

  let value: string;
  try {
    value = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = digest(value);

  // Compared in constant time, and only once the lengths match — timingSafeEqual
  // throws on a length mismatch rather than returning false.
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return null;

  return value;
}

export const DOB_COOKIE = "dt_dob";
export const DEMO_COOKIE = "dt_demo";

/** Long enough to finish a signup, short enough not to linger. */
export const DOB_COOKIE_MAX_AGE = 60 * 30;
export const DEMO_COOKIE_MAX_AGE = 60 * 60 * 24;

export const signedCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;
