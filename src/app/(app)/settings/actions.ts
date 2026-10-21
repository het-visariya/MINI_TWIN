"use server";

/**
 * Privacy & control mutations.
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
import { getSession, requireUser, requireWriter } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db";
import {
  aiConsentSchema,
  deleteAccountSchema,
  profilePreferencesSchema,
} from "@/lib/validation/settings";
import { formDataToObject, invalid, type ActionResult } from "@/lib/validation/shared";

function done() {
  revalidatePath("/settings");
  revalidatePath("/home");
}

/* -------------------------------------------------------------------------- */
/*                            profile & preferences                           */
/* -------------------------------------------------------------------------- */

export async function savePreferences(formData: FormData): Promise<ActionResult> {
  try {
    const writer = await requireWriter();
    if (writer.kind === "demo") return { ok: true, data: undefined };

    const parsed = profilePreferencesSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const prisma = getPrisma();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: writer.userId },
        data: { name: parsed.data.name },
      }),
      prisma.profile.update({
        where: { userId: writer.userId },
        data: {
          lifeStage: parsed.data.lifeStage ?? null,
          regreterTone: parsed.data.regreterTone,
        },
      }),
    ]);

    done();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/**
 * The AI consent switches.
 *
 * Revoking consent clears `aiConsentAt`, which is what makes the twin ask
 * again before its next call rather than remembering a yes from last month.
 */
export async function saveAiConsent(formData: FormData): Promise<ActionResult> {
  try {
    const writer = await requireWriter();
    if (writer.kind === "demo") return { ok: true, data: undefined };

    const parsed = aiConsentSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await getPrisma().profile.update({
      where: { userId: writer.userId },
      data: {
        aiConsentAt: parsed.data.aiConsent ? new Date() : null,
        allowHealthDataToAi: parsed.data.allowHealthDataToAi,
        allowMoneyDataToAi: parsed.data.allowMoneyDataToAi,
      },
    });

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
    const writer = await requireWriter();
    if (writer.kind === "demo") return { ok: true, data: undefined };

    const session = await getSession();
    const currentToken = session?.session?.token;

    await getPrisma().session.deleteMany({
      where: {
        userId: writer.userId,
        ...(currentToken ? { token: { not: currentToken } } : {}),
      },
    });

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
 * Deletes the `User` row and lets the schema's `onDelete: Cascade` take every
 * domain table with it. That is the whole point of the schema rule that every
 * domain row carries a `userId` with a cascade: the deletion is complete by
 * construction, rather than by someone remembering to add each new table to a
 * list in this file.
 *
 * Requires a session created within the last ten minutes. Somebody who walked
 * away from an unlocked laptop should not have their account deleted by the
 * next person to sit down.
 */
export async function deleteAccount(formData: FormData): Promise<ActionResult> {
  let shouldRedirect = false;

  try {
    const writer = await requireWriter();

    if (writer.kind === "demo") {
      return {
        ok: false,
        error: "There is no account to delete in the demo.",
      };
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

    await getPrisma().user.delete({ where: { id: writer.userId } });

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
  const { userId } = await requireUser().catch(() => ({ userId: null }));

  if (userId) {
    await getAuth().api.signOut({ headers: await headers() });
  }

  redirect("/login");
}

function failure(error: unknown): ActionResult<never> {
  const message = error instanceof Error ? error.message : "unknown error";

  if (message === "Not signed in.") {
    return { ok: false, error: "Your session has expired. Sign in again." };
  }

  console.error(`[settings action] ${message}`);

  return {
    ok: false,
    error: "That did not save. Nothing was changed — try again in a moment.",
  };
}
