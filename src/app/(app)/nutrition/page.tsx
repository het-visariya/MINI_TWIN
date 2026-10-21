import { Salad } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import {
  deleteMeal,
  logMeal,
  relogSavedMeal,
  saveDietProfile,
  saveMealAs,
} from "@/app/(app)/nutrition/actions";
import { BarRows } from "@/components/patterns/charts";
import { DeleteButton } from "@/components/patterns/delete-button";
import { ModuleTabs } from "@/components/patterns/module-tabs";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState, GridSkeleton } from "@/components/patterns/states";
import { MealComposer } from "@/components/nutrition/meal-composer";
import {
  DietProfileForm,
  FoodSearch,
  SaveMealAsForm,
  SavedMeals,
} from "@/components/nutrition/nutrition-panels";
import { getNutritionRepo } from "@/lib/data/repo";
import { isoDate } from "@/lib/domain/calc/health";
import type { NutritionView } from "@/lib/data/nutrition.repo";
import type { MealType } from "@/lib/domain/calc/nutrition";

export const metadata: Metadata = { title: "Nutrition" };

const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  SNACK: "Snacks",
  DINNER: "Dinner",
};

const MEAL_ORDER: MealType[] = ["BREAKFAST", "LUNCH", "SNACK", "DINNER"];

export default function NutritionPage() {
  return (
    <Suspense fallback={<GridSkeleton count={4} />}>
      <NutritionContent />
    </Suspense>
  );
}

async function NutritionContent() {
  const repo = await getNutritionRepo();
  const now = new Date();
  const view = await repo.getNutrition(now);
  const today = isoDate(now);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nutrition"
        description="Log a meal by typing it. Every number here is an estimate, and the ones we could not match are marked rather than guessed."
        askAbout="what I have been eating"
      />

      <ModuleTabs
        tabs={[
          { value: "today", label: "Today", content: <TodayTab view={view} today={today} /> },
          {
            value: "foods",
            label: "Food table",
            content: (
              <section className="bg-card shadow-card rounded-xl border p-4">
                <h2 className="text-base font-medium">Food table</h2>
                <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
                  What the parser matches against. {view.foods.length} foods.
                </p>
                <FoodSearch foods={view.foods} />
              </section>
            ),
          },
          {
            value: "preferences",
            label: "Preferences",
            content: (
              <DietProfileForm
                action={saveDietProfile}
                dietType={view.profile.dietType}
                allergies={view.profile.allergies}
              />
            ),
          },
        ]}
      />

      <p className="text-muted-foreground border-t pt-4 text-xs">
        Not a dietitian. Estimates are marked. Nothing on this screen is a diet plan, and
        your twin never nudges you about food or weight.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    today                                   */
/* -------------------------------------------------------------------------- */

function TodayTab({ view, today }: { view: NutritionView; today: string }) {
  const { today: meals, totals, targets, savedMeals } = view;

  const byType = MEAL_ORDER.map((type) => ({
    type,
    meals: meals.filter((meal) => meal.mealType === type),
  })).filter((group) => group.meals.length > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <MealComposer
          action={logMeal}
          foods={view.foods}
          today={today}
          allergies={view.profile.allergies}
        />

        <section aria-labelledby="today-heading" className="space-y-3">
          <h2 id="today-heading" className="text-base font-medium">
            Today
          </h2>

          {meals.length === 0 ? (
            <EmptyState
              icon={Salad}
              title="Nothing logged today"
              purpose="Type a meal above and it appears here, grouped by meal, with the day's totals against an estimated range."
              action={
                <p className="text-muted-foreground text-xs">
                  &ldquo;2 rotis and dal&rdquo; is enough to start.
                </p>
              }
            />
          ) : (
            byType.map((group) => (
              <section key={group.type} aria-labelledby={`meal-${group.type}`}>
                <h3
                  id={`meal-${group.type}`}
                  className="text-muted-foreground mb-1.5 text-xs font-medium"
                >
                  {MEAL_LABELS[group.type]}
                </h3>

                <ul className="space-y-2">
                  {group.meals.map((meal) => (
                    <li
                      key={meal.id}
                      className="bg-card shadow-card rounded-xl border p-3.5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <ul className="space-y-1">
                            {meal.items.map((item) => (
                              <li key={item.id} className="text-sm">
                                <span className="font-medium">
                                  {item.matchedName ?? item.label}
                                </span>
                                {item.matchedName && (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    × {item.quantity}
                                  </span>
                                )}
                                <span className="text-muted-foreground tabular font-mono text-xs">
                                  {" "}
                                  · {Math.round(item.kcal)} kcal
                                </span>
                                {item.isEstimate && (
                                  <span className="text-muted-foreground text-2xs">
                                    {" "}
                                    · estimate
                                  </span>
                                )}
                                {!item.matchedName && (
                                  <span className="text-attention text-2xs">
                                    {" "}
                                    · not matched
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>

                          <p className="text-muted-foreground tabular mt-2 border-t pt-2 font-mono text-xs">
                            {meal.totals.kcal} kcal · P {meal.totals.proteinG} g · C{" "}
                            {meal.totals.carbsG} g · F {meal.totals.fatG} g
                          </p>

                          <div className="mt-2">
                            <SaveMealAsForm action={saveMealAs} mealLogId={meal.id} />
                          </div>
                        </div>

                        <DeleteButton
                          action={deleteMeal}
                          name="mealLogId"
                          id={meal.id}
                          label="this meal"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </section>
      </div>

      <div className="space-y-6">
        <section
          aria-labelledby="totals-heading"
          className="bg-card shadow-card rounded-xl border p-4"
        >
          <h2 id="totals-heading" className="text-sm font-medium">
            Today against an estimate
          </h2>

          {targets.kcal === null && targets.proteinG === null ? (
            <p className="text-muted-foreground mt-2 text-xs">
              Add your height, weight and activity level on the Health screen and a range
              appears here. Without them there is nothing honest to compare against.
            </p>
          ) : (
            <div className="mt-3">
              <BarRows
                rows={[
                  {
                    label: "Energy",
                    value: totals.kcal,
                    target: targets.kcal ?? undefined,
                    display: targets.kcal
                      ? `${totals.kcal} / ~${targets.kcal} kcal`
                      : `${totals.kcal} kcal`,
                  },
                  {
                    label: "Protein",
                    value: totals.proteinG,
                    target: targets.proteinG?.max,
                    display: targets.proteinG
                      ? `${totals.proteinG} / ${targets.proteinG.min}–${targets.proteinG.max} g`
                      : `${totals.proteinG} g`,
                  },
                  {
                    label: "Carbs",
                    value: totals.carbsG,
                    target: targets.carbsG ?? undefined,
                    display: targets.carbsG
                      ? `${totals.carbsG} / ~${targets.carbsG} g`
                      : `${totals.carbsG} g`,
                  },
                  {
                    label: "Fat",
                    value: totals.fatG,
                    target: targets.fatG ?? undefined,
                    display: targets.fatG
                      ? `${totals.fatG} / ~${targets.fatG} g`
                      : `${totals.fatG} g`,
                  },
                ]}
                caption="Ranges are population estimates, not targets set for you."
              />
            </div>
          )}

          <p className="text-muted-foreground mt-3 border-t pt-2 text-2xs leading-relaxed">
            Logged on {view.daysLoggedLast14} of the last 14 days. There is no streak here
            and nothing resets to zero.
          </p>
        </section>

        <section
          aria-labelledby="saved-heading"
          className="bg-card shadow-card rounded-xl border p-4"
        >
          <h2 id="saved-heading" className="text-sm font-medium">
            Saved meals
          </h2>
          <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
            One tap to log again. Allergies are re-checked each time.
          </p>
          <SavedMeals action={relogSavedMeal} savedMeals={savedMeals} today={today} />
        </section>
      </div>
    </div>
  );
}
