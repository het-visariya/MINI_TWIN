"use server";

/**
 * Health mutations.
 *
 * Every action in this file follows the same five steps, in this order:
 * resolve the writer, parse the input, call the repo, revalidate, return a
 * result. None of them throws at the client — a thrown error in a server
 * action reaches the browser as an opaque digest, which tells the user
 * nothing — so every failure comes back as `{ ok: false, error }`.
 *
 * `requireWriter` is what makes an unauthenticated POST impossible: the proxy
 * and the layout both ran earlier, but an action is its own entry point and a
 * caller can reach it directly.
 */

import { revalidatePath } from "next/cache";

import { requireWriter } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db";
import { demoHealthRepo, healthRepoForUser, type HealthRepo } from "@/lib/data/health.repo";
import { ageYears as toAgeYears } from "@/lib/domain/calc/health";
import {
  healthProfileSchema,
  moodCheckinSchema,
  sleepLogSchema,
  waterLogSchema,
  weightGoalSchema,
  weightLogSchema,
  workoutSessionSchema,
} from "@/lib/validation/health";
import { formDataToObject, invalid, type ActionResult } from "@/lib/validation/shared";

/** The repo for whoever is calling: their own rows, or the demo no-ops. */
async function resolve(): Promise<{ repo: HealthRepo; demo: boolean; userId?: string }> {
  const writer = await requireWriter();

  if (writer.kind === "demo") return { repo: demoHealthRepo, demo: true };

  return {
    repo: healthRepoForUser(writer.userId),
    demo: false,
    userId: writer.userId,
  };
}

function done(): void {
  revalidatePath("/health");
  /* Workouts and sleep feed the Home snapshot's capacity figures, so Home is
     stale the moment one is logged. */
  revalidatePath("/home");
}

/* -------------------------------------------------------------------------- */
/*                                  profile                                   */
/* -------------------------------------------------------------------------- */

export async function saveHealthProfile(formData: FormData): Promise<ActionResult> {
  try {
    const { repo } = await resolve();

    const parsed = healthProfileSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.saveProfile(parsed.data);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/*                                  workouts                                  */
/* -------------------------------------------------------------------------- */

/**
 * Sets arrive as parallel arrays — `exercise`, `reps`, `weightKg` repeated
 * once per row — because that is what a form with repeated field names posts.
 * They are zipped back into objects here rather than in the schema so the
 * schema stays a plain description of one set.
 */
export async function logWorkout(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const { repo } = await resolve();

    const exercises = formData.getAll("exercise").map(String);
    const reps = formData.getAll("reps").map(String);
    const weights = formData.getAll("weightKg").map(String);

    const sets = exercises.map((exercise, index) => ({
      exercise,
      reps: reps[index] ?? "0",
      weightKg: weights[index] ?? "0",
    }));

    const parsed = workoutSessionSchema.safeParse({
      date: formData.get("date"),
      notes: formData.get("notes") ?? undefined,
      sets,
    });
    if (!parsed.success) return invalid(parsed.error);

    const session = await repo.logWorkout(parsed.data);
    done();

    return { ok: true, data: session };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteWorkout(formData: FormData): Promise<ActionResult> {
  try {
    const { repo } = await resolve();

    const sessionId = String(formData.get("sessionId") ?? "").trim();
    if (!sessionId) return { ok: false, error: "That workout could not be found." };

    await repo.deleteWorkout(sessionId);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/*                                    body                                    */
/* -------------------------------------------------------------------------- */

export async function logWeight(formData: FormData): Promise<ActionResult> {
  try {
    const { repo } = await resolve();

    const parsed = weightLogSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.logWeight(parsed.data);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/**
 * A weight goal, for adults only.
 *
 * The age comes from the Profile row the age gate wrote, read here on the
 * server. The client never supplies it, so a hand-written POST claiming to be
 * 25 is rejected on the same rule as the hidden form control. Stored in
 * `traits` because it is a stated preference, not a measurement.
 */
export async function saveWeightGoal(formData: FormData): Promise<ActionResult> {
  try {
    const writer = await requireWriter();

    if (writer.kind === "demo") {
      /* The demo has no profile to read an age from, and inventing one to
         decide a safety rule would be exactly the wrong shortcut. */
      return { ok: true, data: undefined };
    }

    const age = toAgeYears(writer.profile.dob, new Date());

    const parsed = weightGoalSchema(age).safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const traits = (writer.profile.traits ?? {}) as Record<string, unknown>;

    await getPrisma().profile.update({
      where: { userId: writer.userId },
      data: {
        traits: {
          ...traits,
          weightGoalKg: parsed.data.targetKg,
          weightGoalBy: parsed.data.byDate ? parsed.data.byDate.toISOString() : null,
        },
      },
    });

    done();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/*                              sleep, water, mood                            */
/* -------------------------------------------------------------------------- */

export async function logSleep(formData: FormData): Promise<ActionResult> {
  try {
    const { repo } = await resolve();

    const parsed = sleepLogSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.logSleep(parsed.data);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function logWater(formData: FormData): Promise<ActionResult> {
  try {
    const { repo } = await resolve();

    const parsed = waterLogSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.logWater(parsed.data);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function saveMoodCheckin(formData: FormData): Promise<ActionResult> {
  try {
    const { repo } = await resolve();

    const parsed = moodCheckinSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.saveMood(parsed.data);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/*                                  failures                                  */
/* -------------------------------------------------------------------------- */

/**
 * The only error the client ever sees.
 *
 * "Not signed in" is passed through because the UI acts on it by sending the
 * user to log in. Everything else is logged server-side and replaced with one
 * neutral sentence: a Prisma constraint name or a connection string in a toast
 * is both useless to the user and a disclosure.
 */
function failure(error: unknown): ActionResult<never> {
  const message = error instanceof Error ? error.message : "unknown error";

  if (message === "Not signed in.") {
    return { ok: false, error: "Your session has expired. Sign in again to save this." };
  }

  console.error(`[health action] ${message}`);

  return {
    ok: false,
    error: "That did not save. Nothing was changed — try again in a moment.",
  };
}
