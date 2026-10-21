/**
 * Nutrition input schemas.
 *
 * The allergy rule is the one worth reading: `confirmedAllergyWarning` is a
 * required part of the save payload, not a client-side nicety. A meal that
 * conflicts with a declared allergen is refused by the action unless the user
 * has explicitly ticked past the warning, so a POST that skips the UI is
 * refused too.
 */

import { z } from "zod";

import { boundedDate, checkbox, optionalText, shortText, stringList } from "@/lib/validation/shared";

export const mealType = z.enum(["BREAKFAST", "LUNCH", "SNACK", "DINNER"]);

export const dietType = z.enum([
  "VEGETARIAN",
  "EGGETARIAN",
  "NON_VEGETARIAN",
  "VEGAN",
  "JAIN",
]);

export const dietProfileSchema = z.object({
  dietType: dietType.default("VEGETARIAN"),
  allergies: stringList(20),
});

const macro = z.coerce
  .number()
  .min(0, "A macro cannot be negative.")
  .max(10_000, "That value is beyond what this app records.");

export const mealItemSchema = z.object({
  /** Null when the parser matched nothing; the label carries the meaning. */
  foodId: z.string().trim().max(64).optional(),
  label: shortText(160),
  quantity: z.coerce
    .number()
    .min(0.05, "A quantity that small is not worth logging.")
    .max(50, "That quantity is almost certainly a typo.")
    .default(1),
  kcal: macro.default(0),
  proteinG: macro.default(0),
  carbsG: macro.default(0),
  fatG: macro.default(0),
  isEstimate: checkbox.default(false),
});

export const mealLogSchema = z.object({
  date: boundedDate,
  mealType: mealType.default("SNACK"),
  items: z
    .array(mealItemSchema)
    .min(1, "A meal needs at least one item.")
    .max(40, "That is more items than one meal holds."),
  /**
   * Set only when the user has read an allergy warning and chosen to continue.
   * The action checks for conflicts itself and refuses without this.
   */
  confirmedAllergyWarning: checkbox.default(false),
});

export const parseMealSchema = z.object({
  text: z.string().trim().min(1, "Type what you ate.").max(500),
});

export const saveMealAsSchema = z.object({
  mealLogId: z.string().trim().min(1),
  name: shortText(80),
});

export const relogSavedMealSchema = z.object({
  savedMealId: z.string().trim().min(1),
  date: boundedDate,
  mealType: mealType.default("SNACK"),
  confirmedAllergyWarning: checkbox.default(false),
});

export const deleteMealSchema = z.object({ mealLogId: z.string().trim().min(1) });

export const foodSearchSchema = z.object({
  query: optionalText(80),
});

export type MealLogInput = z.infer<typeof mealLogSchema>;
export type MealItemInput = z.infer<typeof mealItemSchema>;
export type DietProfileInput = z.infer<typeof dietProfileSchema>;
