"use server";

/**
 * Career mutations.
 *
 * Every id that arrives from the client is checked against the caller's own
 * rows before it is used — a requirement cannot be attached to somebody
 * else's goal, and a roadmap item belonging to another user matches nothing
 * rather than erroring in a way that confirms it exists.
 */

import { revalidatePath } from "next/cache";

import { requireWriter } from "@/lib/auth/session";
import { careerRepoForUser, demoCareerRepo, type CareerRepo } from "@/lib/data/career.repo";
import {
  careerGoalSchema,
  certificationSchema,
  placementSchema,
  projectSchema,
  reorderRoadmapSchema,
  requirementSchema,
  roadmapItemSchema,
  userSkillSchema,
} from "@/lib/validation/career";
import { formDataToObject, invalid, type ActionResult } from "@/lib/validation/shared";

async function resolve(): Promise<CareerRepo> {
  const writer = await requireWriter();
  return writer.kind === "demo" ? demoCareerRepo : careerRepoForUser(writer.userId);
}

function done() {
  revalidatePath("/career");
}

function deleteAction(
  field: string,
  call: (repo: CareerRepo, id: string) => Promise<void>,
  missing: string,
) {
  return async function remove(formData: FormData): Promise<ActionResult> {
    try {
      const repo = await resolve();

      const id = String(formData.get(field) ?? "").trim();
      if (!id) return { ok: false, error: missing };

      await call(repo, id);
      done();

      return { ok: true, data: undefined };
    } catch (error) {
      return failure(error);
    }
  };
}

/* ---------------------------------- goal ---------------------------------- */

export async function saveCareerGoal(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const parsed = careerGoalSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.saveGoal(parsed.data);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function saveRequirement(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const parsed = requirementSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.saveRequirement(
      parsed.data.careerGoalId,
      parsed.data.skill,
      parsed.data.requiredLevel,
    );
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export const deleteRequirement = deleteAction(
  "requirementId",
  (repo, id) => repo.deleteRequirement(id),
  "That requirement could not be found.",
);

/* --------------------------------- skills --------------------------------- */

export async function saveSkill(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const parsed = userSkillSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.saveSkill(parsed.data);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export const deleteSkill = deleteAction(
  "skillId",
  (repo, id) => repo.deleteSkill(id),
  "That skill could not be found.",
);

/* ------------------------- certifications & projects ---------------------- */

export async function addCertification(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const parsed = certificationSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.addCertification(parsed.data);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export const deleteCertification = deleteAction(
  "certificationId",
  (repo, id) => repo.deleteCertification(id),
  "That certification could not be found.",
);

export async function addProject(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const parsed = projectSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.addProject(parsed.data);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export const deleteProject = deleteAction(
  "projectId",
  (repo, id) => repo.deleteProject(id),
  "That project could not be found.",
);

/* -------------------------------- placement ------------------------------- */

export async function savePlacement(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const parsed = placementSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.savePlacement(parsed.data.stage, parsed.data.notes);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/* --------------------------------- roadmap -------------------------------- */

export async function addRoadmapItem(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const parsed = roadmapItemSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.addRoadmapItem(
      parsed.data.careerGoalId,
      parsed.data.title,
      parsed.data.dueDate,
    );
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function toggleRoadmapItem(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const itemId = String(formData.get("itemId") ?? "").trim();
    if (!itemId) return { ok: false, error: "That item could not be found." };

    await repo.toggleRoadmapItem(itemId);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Persist a new order.
 *
 * The client sends the full list of ids in their new order rather than a
 * "moved from 2 to 5" instruction: an index-based message is ambiguous if the
 * list changed underneath, and the full list is self-describing.
 */
export async function reorderRoadmap(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const parsed = reorderRoadmapSchema.safeParse({
      careerGoalId: formData.get("careerGoalId"),
      orderedIds: formData.getAll("orderedIds").map(String),
    });
    if (!parsed.success) return invalid(parsed.error);

    await repo.reorderRoadmap(parsed.data.careerGoalId, parsed.data.orderedIds);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export const deleteRoadmapItem = deleteAction(
  "itemId",
  (repo, id) => repo.deleteRoadmapItem(id),
  "That item could not be found.",
);

/* -------------------------------- failures -------------------------------- */

function failure(error: unknown): ActionResult<never> {
  const message = error instanceof Error ? error.message : "unknown error";

  if (message === "Not signed in.") {
    return { ok: false, error: "Your session has expired. Sign in again to save this." };
  }

  /* "could not be found" is the repo telling us an id did not match the
     caller's rows. Passed through, because it is accurate and discloses
     nothing: the caller already knew the id they sent. */
  if (message.endsWith("could not be found.")) {
    return { ok: false, error: message };
  }

  console.error(`[career action] ${message}`);

  return {
    ok: false,
    error: "That did not save. Nothing was changed — try again in a moment.",
  };
}
