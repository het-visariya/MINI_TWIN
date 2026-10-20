import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import type { Profile } from "@/generated/prisma/client";
import { getAuth } from "@/lib/auth/auth";
import { checkAge, parseDob } from "@/lib/auth/age";
import {
  DEMO_COOKIE,
  DOB_COOKIE,
  signedCookieOptions,
  unsign,
} from "@/lib/auth/signed-cookie";
import { getPrisma } from "@/lib/db";

/**
 * The authoritative session check.
 *
 * `src/proxy.ts` only looks at whether a session cookie exists, which is cheap
 * but says nothing about whether it is valid. Every layout, server action and
 * route handler that touches user data calls into this file instead — the
 * proxy is a redirect for the common case, not the guard.
 */

export type Viewer =
  | { kind: "user"; userId: string; email: string; name: string; profile: Profile }
  /** Signed-in, but no date of birth on file yet — Google sign-in can do this. */
  | { kind: "needs-age-gate"; userId: string }
  /** Browsing sample data. Reads fixtures, writes nothing. */
  | { kind: "demo" }
  | { kind: "anonymous" };

export async function getSession() {
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
}

export async function isDemo() {
  const store = await cookies();

  try {
    return unsign(store.get(DEMO_COOKIE)?.value) === "1";
  } catch {
    /* No signing secret configured. A cookie that cannot be verified is not
       trusted, so demo mode is simply off rather than the request failing. */
    return false;
  }
}

/**
 * Resolves who is making this request, creating the Profile row on the first
 * authenticated request if the age gate left a verified date of birth behind.
 */
export async function getViewer(): Promise<Viewer> {
  const session = await getSession().catch(() => null);

  if (!session?.user) {
    return (await isDemo()) ? { kind: "demo" } : { kind: "anonymous" };
  }

  const { id: userId, email, name } = session.user;
  const prisma = getPrisma();

  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (existing) {
    return { kind: "user", userId, email, name: name || email, profile: existing };
  }

  const profile = await createProfileFromAgeGate(userId);
  if (!profile) return { kind: "needs-age-gate", userId };

  return { kind: "user", userId, email, name: name || email, profile };
}

/**
 * Email signup writes the Profile in the same action that creates the account.
 * Google sign-in cannot: the OAuth callback carries no date of birth. In that
 * case the gate's signed cookie — set before the Google button is usable — is
 * what we read here. Without it, the user is sent back through the gate rather
 * than given an account with an unknown age.
 */
async function createProfileFromAgeGate(userId: string): Promise<Profile | null> {
  const store = await cookies();
  const value = unsign(store.get(DOB_COOKIE)?.value);
  if (!value) return null;

  const verdict = checkAge(value);
  if (verdict.outcome !== "allowed") return null;

  const dob = parseDob(value);
  if (!dob) return null;

  return getPrisma().profile.create({ data: { userId, dob } });
}

/**
 * For layouts and pages. Redirects rather than throwing, and sends
 * unauthenticated users to login with the path they wanted.
 */
export async function requireViewer(next: string): Promise<Viewer> {
  const viewer = await getViewer();

  switch (viewer.kind) {
    case "user":
    case "demo":
      return viewer;
    case "needs-age-gate":
      redirect("/signup?resume=1");
    case "anonymous":
      redirect(`/login?next=${encodeURIComponent(next)}`);
  }
}

/**
 * For server actions and route handlers that write. Throws instead of
 * redirecting — an action has no page to redirect to — and refuses demo mode,
 * which must never reach a real row.
 */
export async function requireUser(): Promise<{ userId: string; profile: Profile }> {
  const viewer = await getViewer();

  if (viewer.kind !== "user") {
    throw new Error("Not signed in.");
  }

  return { userId: viewer.userId, profile: viewer.profile };
}

/** Clears the gate cookie once it has been spent. */
export async function clearDobCookie() {
  const store = await cookies();
  store.set(DOB_COOKIE, "", { ...signedCookieOptions, maxAge: 0 });
}
