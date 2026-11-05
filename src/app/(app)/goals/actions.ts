"use server";

/**
 * Goal mutations.
 *
 * Separate from the task actions because goals revalidate different screens:
 * a goal's weekly hours feed the capacity and conflict calculations on
 * Planning and Insights, where a task's deadline does not.
 */

import { revalidatePath } from "next/cache";

import { requireWriter } from "@/lib/auth/session";
import { planningRepoForUser, type WriteResult } from "@/lib/data/planning.repo";
import {
  adjustGoalSchema,
  createGoalSchema,
  deleteGoalSchema,
} from "@/lib/validation/planning";
import { formDataToObject, invalid, type ActionResult } from "@/lib/validation/shared";

function done(): void {
  revalidatePath("/goals");
  /* weeklyHours feeds the capacity figures these two render. */
  revalidatePath("/home");
  revalidatePath("/insights");
}

async function writer() {
  const resolved = await requireWriter();

  if (resolved.kind === "demo") return { demo: true as const };

  return { demo: false as const, repo: planningRepoForUser(resolved.userId) };
}

function toActionResult(result: WriteResult<unknown>): ActionResult<{ id: string }> {
  if (!result.ok) return { ok: false, error: result.reason };

  done();
  return { ok: true, data: { id: result.id } };
}

const DEMO_OK: ActionResult<{ id: string }> = { ok: true, data: { id: "demo" } };

export async function createGoal(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createGoalSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const resolved = await writer();
    if (resolved.demo) return DEMO_OK;

    return toActionResult(await resolved.repo.createGoal(parsed.data));
  } catch (error) {
    return failure(error);
  }
}

export async function adjustGoal(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const raw = formDataToObject(formData);
    const parsed = adjustGoalSchema.safeParse({
      ...raw,
      /* Empty clears the target date, which is a real intent: a goal without
         a deadline is still a goal. */
      targetDate: raw.targetDate === "" ? null : raw.targetDate,
    });
    if (!parsed.success) return invalid(parsed.error);

    const resolved = await writer();
    if (resolved.demo) return DEMO_OK;

    return toActionResult(await resolved.repo.adjustGoal(parsed.data));
  } catch (error) {
    return failure(error);
  }
}

export async function deleteGoal(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = deleteGoalSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const resolved = await writer();
    if (resolved.demo) return DEMO_OK;

    return toActionResult(await resolved.repo.deleteGoal(parsed.data.goalId));
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown): ActionResult<never> {
  const message = error instanceof Error ? error.message : "unknown error";

  if (message === "Not signed in.") {
    return { ok: false, error: "Your session has expired. Sign in again to save this." };
  }

  console.error(`[goals action] ${message}`);

  return {
    ok: false,
    error: "That did not save. Nothing was changed — try again in a moment.",
  };
}
