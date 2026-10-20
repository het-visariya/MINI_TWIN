"use server";

import { cookies, headers } from "next/headers";

import { checkAge, parseDob, type AgeVerdict } from "@/lib/auth/age";
import { getAuth } from "@/lib/auth/auth";
import {
  DOB_COOKIE,
  DOB_COOKIE_MAX_AGE,
  signedCookieOptions,
  sign,
  unsign,
} from "@/lib/auth/signed-cookie";
import { getPrisma } from "@/lib/db";

/**
 * Signup, in two server-side steps.
 *
 * The age gate runs here and not only in the browser. The form checks the date
 * as you type so the feedback is immediate, but that check is a convenience —
 * this file is what actually decides, and `createAccount` refuses to run at
 * all without a signed cookie proving the gate was passed.
 */

export type AgeGateResult = { verdict: AgeVerdict };

export async function verifyAge(dobValue: string): Promise<AgeGateResult> {
  const verdict = checkAge(dobValue);
  const store = await cookies();

  if (verdict.outcome !== "allowed") {
    /* A blocked or invalid date clears any previous pass, so you cannot get
       through by submitting a valid date and then changing it. */
    store.set(DOB_COOKIE, "", { ...signedCookieOptions, maxAge: 0 });
    return { verdict };
  }

  store.set(DOB_COOKIE, sign(dobValue.trim()), {
    ...signedCookieOptions,
    maxAge: DOB_COOKIE_MAX_AGE,
  });

  return { verdict };
}

/** Has the gate been passed in this browser? Gates the Google button too. */
export async function hasPassedAgeGate(): Promise<boolean> {
  const store = await cookies();
  const value = unsign(store.get(DOB_COOKIE)?.value);
  return value ? checkAge(value).outcome === "allowed" : false;
}

export type SignUpResult =
  | { ok: true; email: string }
  | { ok: false; error: string; field?: "name" | "email" | "password" | "dob" };

export async function createAccount(input: {
  name: string;
  email: string;
  password: string;
}): Promise<SignUpResult> {
  const store = await cookies();
  const dobValue = unsign(store.get(DOB_COOKIE)?.value);

  if (!dobValue) {
    return {
      ok: false,
      field: "dob",
      error: "Start again from your date of birth — that step has expired.",
    };
  }

  const verdict = checkAge(dobValue);
  const dob = parseDob(dobValue);

  if (verdict.outcome !== "allowed" || !dob) {
    return { ok: false, field: "dob", error: "That date of birth cannot open an account." };
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) return { ok: false, field: "name", error: "Enter your name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, field: "email", error: "Enter a valid email address." };
  }
  if (input.password.length < 10) {
    return {
      ok: false,
      field: "password",
      error: "Use at least 10 characters. A short phrase works well.",
    };
  }

  try {
    const result = await getAuth().api.signUpEmail({
      body: { name, email, password: input.password },
      headers: await headers(),
    });

    if (!result?.user?.id) {
      return { ok: false, error: "That did not work. Try again in a moment." };
    }

    /* The Profile is written in the same action that created the account, so
       no user can exist without the date of birth that let them in. */
    await getPrisma().profile.create({
      data: { userId: result.user.id, dob },
    });

    store.set(DOB_COOKIE, "", { ...signedCookieOptions, maxAge: 0 });

    return { ok: true, email };
  } catch (error) {
    return { ok: false, ...describeSignUpError(error) };
  }
}

/**
 * Signup is the one place where naming the cause is right: being told "that
 * email already has an account" is how you realise you should log in instead.
 * Login failures stay deliberately generic — see the login form.
 */
function describeSignUpError(error: unknown): { error: string; field?: "email" | "password" } {
  const message = error instanceof Error ? error.message : String(error);

  if (/exist|already|unique/i.test(message)) {
    return {
      field: "email",
      error: "That email already has an account — log in instead?",
    };
  }

  if (/password/i.test(message)) {
    return { field: "password", error: "That password was rejected. Try a longer one." };
  }

  if (/DATABASE_URL|BETTER_AUTH_SECRET|Mailjet/i.test(message)) {
    return {
      error:
        "The server is not fully configured yet, so accounts cannot be created. Try the demo instead.",
    };
  }

  return { error: "Something went wrong creating your account. Nothing was saved." };
}
