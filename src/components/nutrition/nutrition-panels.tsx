"use client";

import { Repeat, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { ActionForm, FieldError, FormError } from "@/components/patterns/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  searchFoods,
  type DietType,
  type FoodRef,
  type MealType,
} from "@/lib/domain/calc/nutrition";
import type { SavedMealView } from "@/lib/data/nutrition.repo";
import type { ActionResult } from "@/lib/validation/shared";

const DIET_TYPES: { value: DietType; label: string }[] = [
  { value: "VEGETARIAN", label: "Vegetarian" },
  { value: "EGGETARIAN", label: "Eggetarian" },
  { value: "NON_VEGETARIAN", label: "Non-vegetarian" },
  { value: "VEGAN", label: "Vegan" },
  { value: "JAIN", label: "Jain" },
];

/**
 * Diet type and allergies.
 *
 * Allergies are free text, one per line, rather than a fixed list — a fixed
 * list would be wrong for somebody with an allergy nobody thought to include,
 * and the matcher works on substrings so it does not need a taxonomy.
 */
export function DietProfileForm({
  action,
  dietType,
  allergies,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  dietType: DietType;
  allergies: string[];
}) {
  return (
    <ActionForm
      action={action}
      successMessage="Saved."
      className="bg-card shadow-card space-y-3 rounded-xl border p-4"
    >
      {({ pending, fieldErrors, result }) => (
        <>
          <div>
            <h2 className="text-base font-medium">What you eat</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Used to filter the food table and to warn you before a meal saves.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="dietType" className="text-xs">
                Diet
              </Label>
              <Select name="dietType" defaultValue={dietType}>
                <SelectTrigger id="dietType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIET_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="allergies" className="text-xs">
                Allergies
              </Label>
              <Textarea
                id="allergies"
                name="allergies"
                rows={3}
                defaultValue={allergies.join("\n")}
                placeholder={"peanut\nshellfish"}
                aria-describedby="allergies-hint"
              />
              <p id="allergies-hint" className="text-muted-foreground mt-1 text-2xs">
                One per line. A meal mentioning any of these cannot save until you confirm.
              </p>
              <FieldError message={fieldErrors.allergies} />
            </div>
          </div>

          <FormError result={result} />

          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

/**
 * Saved meals, re-logged in one tap.
 *
 * The allergy check runs again on the server when this is used, because the
 * user may have declared a new allergen since the meal was saved.
 */
export function SavedMeals({
  action,
  savedMeals,
  today,
}: {
  action: (formData: FormData) => Promise<ActionResult<{ id: string }>>;
  savedMeals: SavedMealView[];
  today: string;
}) {
  const [pending, startTransition] = useTransition();

  const relog = (savedMealId: string, mealType: MealType) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("savedMealId", savedMealId);
      formData.set("date", today);
      formData.set("mealType", mealType);

      const result = await action(formData);
      if (result.ok) toast.success("Logged again.");
      else toast.error(result.error);
    });
  };

  if (savedMeals.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Save a meal you eat often and it appears here, one tap to log again.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {savedMeals.map((meal) => (
        <li key={meal.id} className="bg-surface-2/50 rounded-lg border p-2.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{meal.name}</p>
              <p className="text-muted-foreground mt-0.5 text-2xs">
                {meal.items.map((item) => item.label).join(", ")}
              </p>
              <p className="text-muted-foreground tabular mt-0.5 font-mono text-2xs">
                {meal.totals.kcal} kcal · P {meal.totals.proteinG} g
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => relog(meal.id, nearestMealType())}
            >
              <Repeat aria-hidden />
              Log
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * The food table, searchable.
 *
 * Filtering happens in the browser: the whole table is already on the page for
 * the parser, so a round trip per keystroke would be slower and no more
 * correct. The serving selector multiplies the row's macros so the user can
 * see what two of something comes to without logging it.
 */
export function FoodSearch({ foods }: { foods: FoodRef[] }) {
  const [query, setQuery] = useState("");
  const [servings, setServings] = useState(1);

  const results = useMemo(() => searchFoods(query, foods, 40), [query, foods]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <Label htmlFor="food-search" className="text-xs">
            Search foods
          </Label>
          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="food-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="roti, dal, paneer…"
              className="pl-8"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="w-28">
          <Label htmlFor="servings" className="text-xs">
            Servings
          </Label>
          <Select
            value={String(servings)}
            onValueChange={(value) => setServings(Number(value))}
          >
            <SelectTrigger id="servings">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0.5, 1, 1.5, 2, 3].map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-xs">
          <caption className="text-muted-foreground mb-2 text-left text-xs">
            Per {servings} serving{servings === 1 ? "" : "s"}. Rows marked
            &ldquo;estimate&rdquo; are not from a cited table.
          </caption>
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="py-1.5 font-medium">
                Food
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                kcal
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                P
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                C
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                F
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                Source
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="py-1.5">
                  <span className="font-medium">{row.name}</span>
                  <span className="text-muted-foreground"> · {row.servingLabel}</span>
                </td>
                <td className="tabular py-1.5 text-right font-mono">
                  {Math.round(row.kcal * servings)}
                </td>
                <td className="tabular py-1.5 text-right font-mono">
                  {round1(row.proteinG * servings)}
                </td>
                <td className="tabular py-1.5 text-right font-mono">
                  {round1(row.carbsG * servings)}
                </td>
                <td className="tabular py-1.5 text-right font-mono">
                  {round1(row.fatG * servings)}
                </td>
                <td className="text-muted-foreground py-1.5 text-right">{row.source}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {results.length === 0 && (
          <p className="text-muted-foreground py-3 text-xs">
            Nothing matches that. You can still log it by typing it into
            &ldquo;Log a meal&rdquo; — it will be marked as an estimate.
          </p>
        )}
      </div>
    </div>
  );
}

/** Save the current meal under a name, so it can be re-logged later. */
export function SaveMealAsForm({
  action,
  mealLogId,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  mealLogId: string;
}) {
  return (
    <ActionForm action={action} successMessage="Saved for next time." resetOnSuccess>
      {({ pending, fieldErrors }) => (
        <div className="flex items-end gap-2">
          <input type="hidden" name="mealLogId" value={mealLogId} />
          <div className="w-40">
            <Label htmlFor={`save-as-${mealLogId}`} className="text-2xs">
              Save as
            </Label>
            <Input
              id={`save-as-${mealLogId}`}
              name="name"
              placeholder="Usual lunch"
              required
            />
            <FieldError message={fieldErrors.name} />
          </div>
          <Button type="submit" variant="ghost" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </ActionForm>
  );
}

function nearestMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "BREAKFAST";
  if (hour < 16) return "LUNCH";
  if (hour < 19) return "SNACK";
  return "DINNER";
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
