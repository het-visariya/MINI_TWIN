"use server";

/**
 * Task and commitment mutations.
 *
 * The first write path these models have ever had. Two things to know:
 *
 *   - **Demo mode writes nothing.** It returns success so the UI behaves
 *     normally, because a demo that errors on every button teaches the wrong
 *     thing about the product. Nothing reaches the database.
 *   - **Placement rules are enforced in the repo, not here.** A refusal comes
 *     back as a sentence the user can act on ("Lab is fixed, so it cannot be
 *     moved") rather than a generic failure, and the twin's suggestion engine
 *     gets the identical refusal from the identical code when it calls the
 *     same repo.
 */

import { revalidatePath } from "next/cache";

import { requireWriter } from "@/lib/auth/session";
import { planningRepoForUser, type WriteResult } from "@/lib/data/planning.repo";
import {
  completeTaskSchema,
  createCommitmentSchema,
  createTaskSchema,
  deleteCommitmentSchema,
  deleteTaskSchema,
  rebuildDaySchema,
  rescheduleCommitmentSchema,
  rescheduleTaskSchema,
  updateTaskSchema,
} from "@/lib/validation/planning";
import { formDataToObject, invalid, type ActionResult } from "@/lib/validation/shared";

/**
 * Everything a task or commitment change touches.
 *
 * Home and Insights are included because the snapshot, the time budget and
 * the pulse scores are all derived from these rows — leaving them stale is
 * how a user moves something and sees the old plan still asserted on Home.
 */
function done(): void {
  revalidatePath("/productivity");
  revalidatePath("/home");
  revalidatePath("/insights");
}

async function writer() {
  const resolved = await requireWriter();

  if (resolved.kind === "demo") return { demo: true as const };

  return { demo: false as const, repo: planningRepoForUser(resolved.userId) };
}

/** Turns a repo result into the shape every form in this product expects. */
function toActionResult(result: WriteResult<unknown>): ActionResult<{ id: string }> {
  if (!result.ok) return { ok: false, error: result.reason };

  done();
  return { ok: true, data: { id: result.id } };
}

const DEMO_OK: ActionResult<{ id: string }> = { ok: true, data: { id: "demo" } };

/* -------------------------------------------------------------------------- */
/*                                   tasks                                    */
/* -------------------------------------------------------------------------- */

export async function createTask(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createTaskSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const resolved = await writer();
    if (resolved.demo) return DEMO_OK;

    return toActionResult(await resolved.repo.createTask(parsed.data));
  } catch (error) {
    return failure(error);
  }
}

export async function updateTask(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = updateTaskSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const resolved = await writer();
    if (resolved.demo) return DEMO_OK;

    return toActionResult(await resolved.repo.updateTask(parsed.data));
  } catch (error) {
    return failure(error);
  }
}

export async function rescheduleTask(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const raw = formDataToObject(formData);
    const parsed = rescheduleTaskSchema.safeParse({
      ...raw,
      /* An empty field means "clear the deadline", which is a real intent and
         not a missing value. */
      due: raw.due === "" || raw.due === undefined ? null : raw.due,
    });
    if (!parsed.success) return invalid(parsed.error);

    const resolved = await writer();
    if (resolved.demo) return DEMO_OK;

    return toActionResult(await resolved.repo.rescheduleTask(parsed.data));
  } catch (error) {
    return failure(error);
  }
}

export async function completeTask(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const raw = formDataToObject(formData);
    const parsed = completeTaskSchema.safeParse({
      taskId: raw.taskId,
      /* Absent means "mark done"; "false" reopens. One verb, so undo is this
         same call with the flag flipped. */
      done: raw.done === undefined ? true : raw.done !== "false",
    });
    if (!parsed.success) return invalid(parsed.error);

    const resolved = await writer();
    if (resolved.demo) return DEMO_OK;

    return toActionResult(await resolved.repo.completeTask(parsed.data));
  } catch (error) {
    return failure(error);
  }
}

export async function deleteTask(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = deleteTaskSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const resolved = await writer();
    if (resolved.demo) return DEMO_OK;

    return toActionResult(await resolved.repo.deleteTask(parsed.data.taskId));
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/*                                commitments                                 */
/* -------------------------------------------------------------------------- */

export async function createCommitment(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createCommitmentSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const resolved = await writer();
    if (resolved.demo) return DEMO_OK;

    return toActionResult(await resolved.repo.createCommitment(parsed.data));
  } catch (error) {
    return failure(error);
  }
}

export async function rescheduleCommitment(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const raw = formDataToObject(formData);
    const parsed = rescheduleCommitmentSchema.safeParse({
      ...raw,
      start: raw.start === "" || raw.start === undefined ? null : raw.start,
    });
    if (!parsed.success) return invalid(parsed.error);

    const resolved = await writer();
    if (resolved.demo) return DEMO_OK;

    /* `now` is passed so a move into the past is refused from the UI. The
       suggestion engine may omit it when backfilling. */
    return toActionResult(
      await resolved.repo.rescheduleCommitment(parsed.data, { now: new Date() }),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function rebuildDay(
  moves: { commitmentId: string; start: string | null }[],
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = rebuildDaySchema.safeParse({ moves });
    if (!parsed.success) return invalid(parsed.error);

    const resolved = await writer();
    if (resolved.demo) return DEMO_OK;

    return toActionResult(await resolved.repo.rebuildDay(parsed.data));
  } catch (error) {
    return failure(error);
  }
}

export async function deleteCommitment(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = deleteCommitmentSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const resolved = await writer();
    if (resolved.demo) return DEMO_OK;

    return toActionResult(
      await resolved.repo.deleteCommitment(parsed.data.commitmentId),
    );
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */

function failure(error: unknown): ActionResult<never> {
  const message = error instanceof Error ? error.message : "unknown error";

  if (message === "Not signed in.") {
    return { ok: false, error: "Your session has expired. Sign in again to save this." };
  }

  console.error(`[productivity action] ${message}`);

  return {
    ok: false,
    error: "That did not save. Nothing was changed — try again in a moment.",
  };
}
