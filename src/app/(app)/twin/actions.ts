"use server";

/**
 * Acting on what the twin suggested.
 *
 * Server actions rather than `POST /api/twin/suggestions/[id]/apply`, which
 * is what the brief specified. The security properties are identical — an
 * action is a server endpoint and re-checks the session exactly as a route
 * handler would — and two things make actions the better fit here:
 *
 *   - `revalidatePath` is the whole point. Applying a suggestion changes rows
 *     that Home, Productivity and Insights render, and those screens have to
 *     be stale the instant it lands. From a route handler the client would
 *     have to know which paths to refresh, which puts that knowledge in the
 *     wrong place.
 *   - Every other mutation in this product is an action. A single endpoint
 *     that worked differently would be the one people forget to keep in step.
 *
 * Say so if you want the REST shape anyway and I will add it; nothing here
 * depends on the choice.
 */

import { revalidatePath } from "next/cache";

import { requireWriter } from "@/lib/auth/session";
import { suggestionsRepoForUser } from "@/lib/data/suggestions.repo";
import type { ActionResult } from "@/lib/validation/shared";

/**
 * Everything a suggestion can touch.
 *
 * Deliberately broad. A rebuild moves commitments, which changes the time
 * budget on Home and the pulse on Insights; a task change does the same. The
 * cost of revalidating a path that did not change is one render, and the cost
 * of missing one is the user watching the old plan assert itself on Home
 * after they accepted a change.
 */
function done(): void {
  revalidatePath("/home");
  revalidatePath("/twin");
  revalidatePath("/productivity");
  revalidatePath("/goals");
  revalidatePath("/insights");
}

async function repo() {
  const writer = await requireWriter();

  /* Demo mode has no account behind it, so there is nothing to change and
     nothing to undo. Saying so is better than a success that does nothing. */
  if (writer.kind === "demo") return null;

  return suggestionsRepoForUser(writer.userId);
}

/* One sentence, reused by all three. Typed as the message rather than as an
   ActionResult so each action can wrap it in its own result shape. */
const DEMO_MESSAGE =
  "Demo mode has no account to change. Sign up and your twin can act on your own plan.";

export async function applySuggestion(
  suggestionId: string,
): Promise<ActionResult<{ undoId: string | null }>> {
  try {
    const suggestions = await repo();
    if (!suggestions) return { ok: false, error: DEMO_MESSAGE };

    const outcome = await suggestions.apply(suggestionId);

    if (!outcome.ok) return { ok: false, error: outcome.reason };

    done();

    /* The undo id travels back with the success so the toast can offer Undo
       without a second round trip to find it. */
    return { ok: true, data: { undoId: outcome.appliedActionId || null } };
  } catch (error) {
    return failure(error, "apply");
  }
}

export async function declineSuggestion(suggestionId: string): Promise<ActionResult> {
  try {
    const suggestions = await repo();
    if (!suggestions) return { ok: false, error: DEMO_MESSAGE };

    const outcome = await suggestions.decline(suggestionId);
    if (!outcome.ok) return { ok: false, error: outcome.reason ?? "That could not be declined." };

    /* Declining changes no plan rows, but it does change what the twin will
       offer next, which the Twin screen renders. */
    revalidatePath("/twin");

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "decline");
  }
}

export async function undoAppliedAction(appliedActionId: string): Promise<ActionResult> {
  try {
    const suggestions = await repo();
    if (!suggestions) return { ok: false, error: DEMO_MESSAGE };

    const outcome = await suggestions.undo(appliedActionId);
    if (!outcome.ok) return { ok: false, error: outcome.reason ?? "That could not be undone." };

    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "undo");
  }
}

function failure(error: unknown, verb: string): ActionResult<never> {
  const message = error instanceof Error ? error.message : "unknown error";

  if (message === "Not signed in.") {
    return { ok: false, error: "Your session has expired. Sign in again." };
  }

  console.error(`[twin ${verb}] ${message}`);

  return {
    ok: false,
    error: `That could not be ${verb === "undo" ? "undone" : `${verb}d`}. Nothing was changed.`,
  };
}
