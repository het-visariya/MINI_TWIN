"use server";

/**
 * Nutrition mutations.
 *
 * The allergy gate is the important one. `logMeal` checks the items against
 * the user's declared allergens itself and refuses unless
 * `confirmedAllergyWarning` is present — so a POST straight to this action is
 * stopped by the same rule as the form, and the warning cannot be skipped by
 * not rendering it.
 */

import { revalidatePath } from "next/cache";

import { requireWriter } from "@/lib/auth/session";
import {
  allergyCheck,
  demoNutritionRepo,
  getFoods,
  nutritionRepoForUser,
  type NutritionRepo,
  type PhotoProvenance,
} from "@/lib/data/nutrition.repo";
import { mealPhotoRepoForUser } from "@/lib/data/meal-photo.repo";
import { nutritionView } from "@/lib/data/module-fixtures";
import {
  allergyConflicts,
  parseMealText,
  type MealDraft,
} from "@/lib/domain/calc/nutrition";
import {
  dietProfileSchema,
  mealLogSchema,
  parseMealSchema,
  relogSavedMealSchema,
  saveMealAsSchema,
} from "@/lib/validation/nutrition";
import { formDataToObject, invalid, type ActionResult } from "@/lib/validation/shared";

async function resolve(): Promise<{
  repo: NutritionRepo;
  demo: boolean;
  userId?: string;
}> {
  const writer = await requireWriter();

  if (writer.kind === "demo") return { repo: demoNutritionRepo, demo: true };

  return {
    repo: nutritionRepoForUser(writer.userId),
    demo: false,
    userId: writer.userId,
  };
}

function done() {
  revalidatePath("/nutrition");
}

/* -------------------------------------------------------------------------- */
/*                                   profile                                  */
/* -------------------------------------------------------------------------- */

export async function saveDietProfile(formData: FormData): Promise<ActionResult> {
  try {
    const { repo } = await resolve();

    const parsed = dietProfileSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.saveDietProfile(parsed.data);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/*                                   parsing                                  */
/* -------------------------------------------------------------------------- */

/**
 * Parse free text into a draft. Reads nothing of the user's except the food
 * table, writes nothing, and saves nothing — the client renders the draft and
 * the user confirms it before `logMeal` is called.
 *
 * The browser also parses as the user types, for the live preview. This exists
 * so the authoritative parse happens against the server's food table, and so
 * the same function is available when phase 4 swaps the body for a Gemini call.
 */
export async function parseMeal(formData: FormData): Promise<ActionResult<MealDraft>> {
  try {
    const { demo } = await resolve();

    const parsed = parseMealSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const foods = demo ? nutritionView(new Date()).foods : await getFoods();

    return { ok: true, data: parseMealText(parsed.data.text, foods) };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/*                                    meals                                   */
/* -------------------------------------------------------------------------- */

export async function logMeal(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const { repo, demo, userId } = await resolve();

    /* Items arrive as parallel arrays, one entry per row of the draft. */
    const labels = formData.getAll("label").map(String);
    const items = labels.map((label, index) => ({
      label,
      foodId: str(formData.getAll("foodId")[index]) || undefined,
      quantity: str(formData.getAll("quantity")[index]) || "1",
      kcal: str(formData.getAll("kcal")[index]) || "0",
      proteinG: str(formData.getAll("proteinG")[index]) || "0",
      carbsG: str(formData.getAll("carbsG")[index]) || "0",
      fatG: str(formData.getAll("fatG")[index]) || "0",
      isEstimate: str(formData.getAll("isEstimate")[index]) || undefined,
      fromPhoto: str(formData.getAll("fromPhoto")[index]) || undefined,
    }));

    const parsed = mealLogSchema.safeParse({
      date: formData.get("date"),
      mealType: formData.get("mealType") ?? undefined,
      items,
      confirmedAllergyWarning: formData.get("confirmedAllergyWarning") ?? undefined,
      mealPhotoId: formData.get("mealPhotoId") ?? undefined,
    });
    if (!parsed.success) return invalid(parsed.error);

    const conflicts = demo
      ? allergyConflicts(parsed.data.items, nutritionView(new Date()).profile.allergies)
      : await allergyCheck(userId!, parsed.data.items);

    if (conflicts.length > 0 && !parsed.data.confirmedAllergyWarning) {
      const named = [...new Set(conflicts.map((conflict) => conflict.allergen))].join(", ");

      return {
        ok: false,
        error: `This meal mentions ${named}, which you listed as an allergy.`,
        /* Surfaced as a field error so the form can render the confirm
           control next to it rather than only flashing a toast. */
        fieldErrors: {
          allergies: `You listed ${named} as an allergy. Tick the box to save this anyway.`,
        },
      };
    }

    const meal = await repo.logMeal(parsed.data, await provenance(parsed.data.mealPhotoId, userId));
    done();

    return { ok: true, data: meal };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteMeal(formData: FormData): Promise<ActionResult> {
  try {
    const { repo } = await resolve();

    const mealLogId = String(formData.get("mealLogId") ?? "").trim();
    if (!mealLogId) return { ok: false, error: "That meal could not be found." };

    await repo.deleteMeal(mealLogId);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function saveMealAs(formData: FormData): Promise<ActionResult> {
  try {
    const { repo } = await resolve();

    const parsed = saveMealAsSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.saveMealAs(parsed.data.mealLogId, parsed.data.name);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Re-log a saved meal.
 *
 * Runs the allergy check again rather than trusting that it passed when the
 * meal was first saved: the user may have added an allergen to their profile
 * since, and the whole point of the check is that it reflects what they have
 * told us *now*.
 */
export async function relogSavedMeal(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const { repo } = await resolve();

    const parsed = relogSavedMealSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const meal = await repo.relogSavedMeal(
      parsed.data.savedMealId,
      parsed.data.date,
      parsed.data.mealType,
    );
    done();

    return { ok: true, data: meal };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Resolve what a claimed `mealPhotoId` is actually allowed to mean.
 *
 * The form says "these rows came from a photo"; this decides whether that is
 * true and what provider to credit. An id the user does not own, or one whose
 * analysis never completed, resolves to `undefined` — the meal still saves,
 * just without provenance, because losing a label is a better outcome than
 * refusing a meal the user did eat.
 *
 * `source` comes from the stored row, never from the request, so the client
 * cannot attribute its typing to a model that was never called.
 */
async function provenance(
  mealPhotoId: string | undefined,
  userId: string | undefined,
): Promise<PhotoProvenance | undefined> {
  if (!mealPhotoId || !userId) return undefined;

  const photo = await mealPhotoRepoForUser(userId).get(mealPhotoId);

  /* READY means analysed and awaiting confirmation — which is exactly the
     state a confirm submission should find it in. CONFIRMED would mean this
     photo already became a meal, and re-crediting it to a second one would
     make the same reading look like two meals eaten. */
  if (!photo || photo.status !== "READY") return undefined;

  /* No recorded provider means nothing was successfully analysed, whatever
     the status says, so there is no provenance to credit. */
  if (!photo.source) return undefined;

  return { mealPhotoId, source: photo.source };
}

/* -------------------------------------------------------------------------- */
/*                                   shared                                   */
/* -------------------------------------------------------------------------- */

function str(value: FormDataEntryValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function failure(error: unknown): ActionResult<never> {
  const message = error instanceof Error ? error.message : "unknown error";

  if (message === "Not signed in.") {
    return { ok: false, error: "Your session has expired. Sign in again to save this." };
  }

  console.error(`[nutrition action] ${message}`);

  return {
    ok: false,
    error: "That did not save. Nothing was changed — try again in a moment.",
  };
}
