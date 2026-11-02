/**
 * The Nutrition module's data boundary.
 *
 * The protein target is read through Health's `proteinRange` rather than being
 * recomputed here, so the number on this screen and the number on the Health
 * screen cannot disagree. Everything else derived — daily totals, the parser's
 * draft, allergy conflicts — comes from `calc/nutrition`.
 */

import { connection } from "next/server";

import { nutritionView } from "@/lib/data/module-fixtures";
import { getPrisma } from "@/lib/db";
import { isoDate, proteinRange, type ActivityLevel } from "@/lib/domain/calc/health";
import {
  allergyConflicts,
  dailyTotals,
  macroTargets,
  type DietType,
  type FoodRef,
  type MealType,
  type Totals,
} from "@/lib/domain/calc/nutrition";
import { calorieEstimate, ageYears as toAgeYears } from "@/lib/domain/calc/health";
import type { DietProfileInput, MealLogInput } from "@/lib/validation/nutrition";

/* -------------------------------------------------------------------------- */
/*                                   views                                    */
/* -------------------------------------------------------------------------- */

export type MealItemView = {
  id: string;
  label: string;
  matchedName: string | null;
  quantity: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isEstimate: boolean;
  servingLabel: string | null;
};

export type MealLogView = {
  id: string;
  date: string;
  mealType: MealType;
  items: MealItemView[];
  totals: Totals;
};

export type SavedMealView = {
  id: string;
  name: string;
  items: { label: string; quantity: number }[];
  totals: Totals;
};

export type NutritionView = {
  profile: { dietType: DietType; allergies: string[] };
  /** The whole food table: the parser and the search box both read it. */
  foods: FoodRef[];
  today: MealLogView[];
  totals: Totals;
  targets: {
    kcal: number | null;
    proteinG: { min: number; max: number } | null;
    carbsG: number | null;
    fatG: number | null;
    isEstimate: true;
  };
  savedMeals: SavedMealView[];
  /** Days in the last fortnight with at least one meal logged. */
  daysLoggedLast14: number;
};

/**
 * Where a photo-derived row came from, resolved by the action from a MealPhoto
 * row it has already confirmed the user owns. The repo takes it as given: it
 * is not in `MealLogInput` precisely so it cannot arrive from a form.
 */
export type PhotoProvenance = {
  mealPhotoId: string;
  source: "PHOTO_GEMINI" | "PHOTO_LOGMEAL";
};

export type NutritionRepo = {
  getNutrition(now?: Date): Promise<NutritionView>;
  saveDietProfile(input: DietProfileInput): Promise<void>;
  logMeal(input: MealLogInput, photo?: PhotoProvenance): Promise<{ id: string }>;
  deleteMeal(mealLogId: string): Promise<void>;
  saveMealAs(mealLogId: string, name: string): Promise<void>;
  relogSavedMeal(savedMealId: string, date: Date, mealType: MealType): Promise<{ id: string }>;
};

/* -------------------------------------------------------------------------- */
/*                                  per user                                  */
/* -------------------------------------------------------------------------- */

export function nutritionRepoForUser(userId: string): NutritionRepo {
  const prisma = getPrisma();

  return {
    async getNutrition(now = new Date()) {
      await connection();

      const startOfToday = atMidnight(now);
      const fortnightAgo = new Date(startOfToday);
      fortnightAgo.setDate(fortnightAgo.getDate() - 13);

      const [profile, dietProfile, healthProfile, latestWeight, foods, today, savedMeals, recent] =
        await Promise.all([
          prisma.profile.findUnique({ where: { userId } }),
          prisma.dietProfile.findUnique({ where: { userId } }),
          prisma.healthProfile.findUnique({ where: { userId } }),
          prisma.weightLog.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
          prisma.food.findMany({ orderBy: { name: "asc" } }),
          prisma.mealLog.findMany({
            where: { userId, date: startOfToday },
            orderBy: { createdAt: "asc" },
            include: { items: { include: { food: true } } },
          }),
          prisma.savedMeal.findMany({
            where: { userId },
            orderBy: { updatedAt: "desc" },
            take: 12,
            include: { items: true },
          }),
          prisma.mealLog.findMany({
            where: { userId, date: { gte: fortnightAgo } },
            select: { date: true },
          }),
        ]);

      const todayViews: MealLogView[] = today.map((meal) => {
        const items: MealItemView[] = meal.items.map((item) => ({
          id: item.id,
          label: item.label,
          matchedName: item.food?.name ?? null,
          quantity: item.quantity,
          kcal: item.kcal,
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
          /* An item is an estimate if it was stored as one, or if the food row
             it points at is itself an estimate. */
          isEstimate: item.isEstimate || item.food?.source === "estimate",
          servingLabel: item.food?.servingLabel ?? null,
        }));

        return {
          id: meal.id,
          date: isoDate(meal.date),
          mealType: meal.mealType as MealType,
          items,
          totals: dailyTotals(items),
        };
      });

      const activityLevel = (healthProfile?.activityLevel ?? "LIGHT") as ActivityLevel;
      const weightKg = latestWeight?.weightKg ?? null;
      const range = proteinRange(weightKg, activityLevel);

      const energy = calorieEstimate({
        weightKg,
        heightCm: healthProfile?.heightCm ?? null,
        ageYears: toAgeYears(profile?.dob ?? null, now),
        sex: profile?.sex ?? null,
        activityLevel,
      });

      return {
        profile: {
          dietType: (dietProfile?.dietType ?? "VEGETARIAN") as DietType,
          allergies: dietProfile?.allergies ?? [],
        },
        foods: foods.map(toFoodRef),
        today: todayViews,
        totals: dailyTotals(todayViews.flatMap((meal) => meal.items)),
        targets: macroTargets({
          kcal: energy?.kcal ?? null,
          proteinMinG: range?.min ?? null,
          proteinMaxG: range?.max ?? null,
        }),
        savedMeals: savedMeals.map((saved) => ({
          id: saved.id,
          name: saved.name,
          items: saved.items.map((item) => ({
            label: item.label,
            quantity: item.quantity,
          })),
          totals: dailyTotals(saved.items),
        })),
        daysLoggedLast14: new Set(recent.map((row) => isoDate(row.date))).size,
      };
    },

    async saveDietProfile(input) {
      await prisma.dietProfile.upsert({
        where: { userId },
        create: { userId, dietType: input.dietType, allergies: input.allergies },
        update: { dietType: input.dietType, allergies: input.allergies },
      });
    },

    /**
     * One meal and its items together.
     *
     * The allergy check happens in the action, not here: it needs the diet
     * profile and the user's explicit confirmation, which is a decision about
     * consent rather than a decision about storage.
     */
    async logMeal(input, photo) {
      const meal = await prisma.mealLog.create({
        data: {
          userId,
          date: input.date,
          mealType: input.mealType,
          items: {
            create: input.items.map((item) => {
              /* A row is photo-derived only if the client flagged it AND the
                 action resolved a photo this user owns. Both halves are
                 required, so neither a stray flag nor a borrowed id is enough. */
              const fromPhoto = Boolean(item.fromPhoto && photo);

              return {
                userId,
                foodId: item.foodId ?? null,
                label: item.label,
                quantity: item.quantity,
                kcal: item.kcal,
                proteinG: item.proteinG,
                carbsG: item.carbsG,
                fatG: item.fatG,
                /* Photo-derived numbers are estimates whatever the form said:
                   the user may edit the values, but editing a guess does not
                   turn it into a measurement. */
                isEstimate: fromPhoto ? true : item.isEstimate,
                source: fromPhoto ? photo!.source : "MANUAL",
                mealPhotoId: fromPhoto ? photo!.mealPhotoId : null,
              };
            }),
          },
        },
        select: { id: true },
      });

      /* Attach the photo to the log it became. This is the step that takes the
         reading off "provider said" and onto the user's record, and it happens
         only here — after the confirm form, never on analysis. */
      if (photo) {
        await prisma.mealPhoto.updateMany({
          where: { id: photo.mealPhotoId, userId },
          data: { status: "CONFIRMED", mealLogId: meal.id },
        });
      }

      return meal;
    },

    async deleteMeal(mealLogId) {
      await prisma.mealLog.deleteMany({ where: { id: mealLogId, userId } });
    },

    /** Turns a logged meal into a reusable one, so re-logging is a single tap. */
    async saveMealAs(mealLogId, name) {
      const meal = await prisma.mealLog.findFirst({
        where: { id: mealLogId, userId },
        include: { items: true },
      });

      if (!meal) throw new Error("That meal could not be found.");

      await prisma.savedMeal.create({
        data: {
          userId,
          name,
          items: {
            create: meal.items.map((item) => ({
              foodId: item.foodId,
              label: item.label,
              quantity: item.quantity,
              kcal: item.kcal,
              proteinG: item.proteinG,
              carbsG: item.carbsG,
              fatG: item.fatG,
              isEstimate: item.isEstimate,
            })),
          },
        },
      });
    },

    async relogSavedMeal(savedMealId, date, mealType) {
      const saved = await prisma.savedMeal.findFirst({
        where: { id: savedMealId, userId },
        include: { items: true },
      });

      if (!saved) throw new Error("That saved meal could not be found.");

      /* A new log every time rather than touching the saved meal: the saved
         meal is a template, and editing today's lunch must not rewrite it. */
      return prisma.mealLog.create({
        data: {
          userId,
          date,
          mealType,
          items: {
            create: saved.items.map((item) => ({
              userId,
              foodId: item.foodId,
              label: item.label,
              quantity: item.quantity,
              kcal: item.kcal,
              proteinG: item.proteinG,
              carbsG: item.carbsG,
              fatG: item.fatG,
              isEstimate: item.isEstimate,
            })),
          },
        },
        select: { id: true },
      });
    },
  };
}

/**
 * The food table, for the parser.
 *
 * Read without a session filter because `Food` is global reference data: it
 * belongs to nobody, and there is nothing in it that is one user's rather than
 * another's.
 */
export async function getFoods(): Promise<FoodRef[]> {
  const foods = await getPrisma().food.findMany({ orderBy: { name: "asc" } });
  return foods.map(toFoodRef);
}

/** Which of these items collide with the user's declared allergens. */
export async function allergyCheck(
  userId: string,
  items: { label: string; matchedName?: string | null }[],
) {
  const profile = await getPrisma().dietProfile.findUnique({ where: { userId } });
  return allergyConflicts(items, profile?.allergies ?? []);
}

/* -------------------------------------------------------------------------- */
/*                                    demo                                    */
/* -------------------------------------------------------------------------- */

export const demoNutritionRepo: NutritionRepo = {
  async getNutrition(now = new Date()) {
    await connection();
    return nutritionView(now);
  },

  async saveDietProfile() {},
  async logMeal() {
    return { id: "demo-meal" };
  },
  async deleteMeal() {},
  async saveMealAs() {},
  async relogSavedMeal() {
    return { id: "demo-meal" };
  },
};

/* -------------------------------------------------------------------------- */
/*                                   shared                                   */
/* -------------------------------------------------------------------------- */

function toFoodRef(row: {
  id: string;
  name: string;
  aliases: string[];
  servingLabel: string;
  servingGrams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
  source: string;
}): FoodRef {
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases,
    servingLabel: row.servingLabel,
    servingGrams: row.servingGrams,
    kcal: row.kcal,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
    fibreG: row.fibreG,
    source: row.source,
  };
}

function atMidnight(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
