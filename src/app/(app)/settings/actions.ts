"use server";

/**
 * Privacy & control mutations.
 *
 * Nothing here touches Prisma. Every write goes through `account.repo.ts`,
 * which is the rule the whole app follows — a screen or an action that reaches
 * past the repo is one that can forget to scope a query by user.
 *
 * Account deletion is the only irreversible action in the product, so it is
 * the one with the most checks: the typed phrase must match exactly, the
 * session must be recent, and the delete relies on the schema's cascades
 * rather than a hand-written list of tables that could fall out of date.
 */

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/lib/auth/auth";
import { getSession, requireWriter } from "@/lib/auth/session";
import {
  accountRepoForUser,
  demoAccountRepo,
  type AccountRepo,
} from "@/lib/data/account.repo";
import {
  aiConsentSchema,
  deleteAccountSchema,
  profilePreferencesSchema,
} from "@/lib/validation/settings";
import { formDataToObject, invalid, type ActionResult } from "@/lib/validation/shared";

async function resolve(): Promise<{ repo: AccountRepo; demo: boolean }> {
  const writer = await requireWriter();

  return writer.kind === "demo"
    ? { repo: demoAccountRepo, demo: true }
    : { repo: accountRepoForUser(writer.userId), demo: false };
}

function done() {
  revalidatePath("/settings");
  revalidatePath("/home");
}

/* -------------------------------------------------------------------------- */
/*                            profile & preferences                           */
/* -------------------------------------------------------------------------- */

export async function savePreferences(formData: FormData): Promise<ActionResult> {
  try {
    const { repo } = await resolve();

    const parsed = profilePreferencesSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.savePreferences({
      name: parsed.data.name,
      lifeStage: parsed.data.lifeStage ?? null,
      regreterTone: parsed.data.regreterTone,
    });

    done();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function saveAiConsent(formData: FormData): Promise<ActionResult> {
  try {
    const { repo } = await resolve();

    const parsed = aiConsentSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.saveAiConsent(parsed.data);

    done();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/*                                  sessions                                  */
/* -------------------------------------------------------------------------- */

/** Sign out everywhere except here. */
export async function signOutOtherSessions(): Promise<ActionResult> {
  try {
    const { repo } = await resolve();

    const session = await getSession();
    await repo.signOutOtherSessions(session?.session?.token);

    done();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/*                              delete account                                */
/* -------------------------------------------------------------------------- */

/** A session older than this must be re-authenticated before deleting. */
const FRESH_SESSION_MINUTES = 10;

/**
 * Delete the account and everything in it.
 *
 * Requires a session created within the last ten minutes. Somebody who walked
 * away from an unlocked laptop should not have their account deleted by the
 * next person to sit down.
 */
export async function deleteAccount(formData: FormData): Promise<ActionResult> {
  let shouldRedirect = false;

  try {
    const { repo, demo } = await resolve();

    if (demo) {
      return { ok: false, error: "There is no account to delete in the demo." };
    }

    const parsed = deleteAccountSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const session = await getSession();
    const createdAt = session?.session?.createdAt;

    if (
      !createdAt ||
      Date.now() - new Date(createdAt).getTime() > FRESH_SESSION_MINUTES * 60_000
    ) {
      return {
        ok: false,
        error:
          "For a change this large, sign out and sign back in first — then delete within ten minutes.",
      };
    }

    await repo.deleteAccount();

    /* Clear the cookies by hand: the session row is already gone, so Better
       Auth's own sign-out has nothing left to look up. */
    const store = await cookies();
    for (const cookie of store.getAll()) {
      if (cookie.name.startsWith("dt")) {
        store.set(cookie.name, "", { path: "/", maxAge: 0 });
      }
    }

    shouldRedirect = true;
  } catch (error) {
    return failure(error);
  }

  /* Outside the try: redirect() signals by throwing, and catching it here
     would turn a successful deletion into an error message. */
  if (shouldRedirect) redirect("/?deleted=1");

  return { ok: true, data: undefined };
}

/**
 * Whether the delete control should be active right now.
 *
 * Read by the page so the form can explain the freshness rule before the user
 * types the phrase, rather than after.
 */
export async function sessionIsFresh(): Promise<boolean> {
  const session = await getSession();
  const createdAt = session?.session?.createdAt;
  if (!createdAt) return false;

  return Date.now() - new Date(createdAt).getTime() <= FRESH_SESSION_MINUTES * 60_000;
}

/* -------------------------------------------------------------------------- */
/*                                  sign out                                  */
/* -------------------------------------------------------------------------- */

export async function signOut(): Promise<void> {
  await getAuth()
    .api.signOut({ headers: await headers() })
    .catch(() => {
      /* Already signed out, or the session is gone. Either way the next line
         is what the user asked for. */
    });

  redirect("/login");
}

function failure(error: unknown): ActionResult<never> {
  const message = error instanceof Error ? error.message : "unknown error";

  if (message === "Not signed in.") {
    return { ok: false, error: "Your session has expired. Sign in again." };
  }

  /* The demo repo's deliberate refusal. Accurate and safe to show. */
  if (message === "There is no account to delete in the demo.") {
    return { ok: false, error: message };
  }

  console.error(`[settings action] ${message}`);

  return {
    ok: false,
    error: "That did not save. Nothing was changed — try again in a moment.",
  };
}
