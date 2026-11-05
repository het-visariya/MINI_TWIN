"use client";

import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";

import { ActionForm, FieldError, FormError } from "@/components/patterns/action-form";
import { MealDraftRow } from "@/components/nutrition/meal-draft-row";
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
import {
  allergyConflicts,
  dailyTotals,
  parseMealText,
  type DraftItem,
  type FoodRef,
  type MealType,
} from "@/lib/domain/calc/nutrition";
import type { ActionResult } from "@/lib/validation/shared";

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "BREAKFAST", label: "Breakfast" },
  { value: "LUNCH", label: "Lunch" },
  { value: "SNACK", label: "Snack" },
  { value: "DINNER", label: "Dinner" },
];

type Row = DraftItem & { key: number };

/**
 * Log a meal by typing it.
 *
 * The parse runs in the browser as the user types, against the same food table
 * the server holds, so the preview is immediate. The server parses and
 * validates again on submit — the client's parse is for the preview, never the
 * authority.
 *
 * Two rules are visible in the UI rather than hidden in a comment:
 *
 *   - An item the parser could not match is shown as "couldn't match", with
 *     empty macro fields for the user to fill in. It is never silently
 *     dropped, and never given invented numbers.
 *   - A declared allergen blocks the save until the user explicitly ticks
 *     past it. The server enforces the same thing, so this is a convenience,
 *     not the guard.
 */
export function MealComposer({
  action,
  foods,
  today,
  allergies,
}: {
  action: (formData: FormData) => Promise<ActionResult<{ id: string }>>;
  foods: FoodRef[];
  today: string;
  allergies: string[];
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);

  /* While the user has not edited the draft, the preview follows the text.
     Once they touch a row, `rows` takes over so their edits are not wiped by
     the next keystroke. */
  const parsed = useMemo(() => {
    if (text.trim().length === 0) return [];
    return parseMealText(text, foods).items.map((item, index) => ({
      ...item,
      key: index,
    }));
  }, [text, foods]);

  const items = rows ?? parsed;
  const totals = dailyTotals(items);
  const conflicts = allergyConflicts(items, allergies);

  const update = (key: number, patch: Partial<Row>) =>
    setRows(items.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const remove = (key: number) => setRows(items.filter((row) => row.key !== key));

  const reset = () => {
    setText("");
    setRows(null);
  };

  return (
    <ActionForm
      action={action}
      successMessage="Meal logged."
      className="bg-card shadow-card space-y-4 rounded-xl border p-4"
      onSuccess={reset}
    >
      {({ pending, fieldErrors, result }) => (
        <>
          <div>
            <h2 className="text-base font-medium">Log a meal</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Type it the way you would say it — &ldquo;2 rotis and dal&rdquo;. Nothing
              saves until you check it below.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[14rem] flex-1">
              <Label htmlFor="meal-text" className="text-xs">
                What did you eat?
              </Label>
              <Input
                id="meal-text"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setRows(null);
                }}
                placeholder="2 rotis and dal, half katori rice"
                autoComplete="off"
              />
            </div>

            <div className="w-32">
              <Label htmlFor="mealType" className="text-xs">
                Meal
              </Label>
              <Select name="mealType" defaultValue={defaultMealType()}>
                <SelectTrigger id="mealType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-36">
              <Label htmlFor="meal-date" className="text-xs">
                Date
              </Label>
              <Input
                id="meal-date"
                name="date"
                type="date"
                defaultValue={today}
                max={today}
                required
              />
            </div>
          </div>

          {items.length > 0 && (
            <>
              <div className="space-y-2">
                <p className="text-xs font-medium">
                  What your twin read ({items.length} item
                  {items.length === 1 ? "" : "s"})
                </p>

                <ul className="space-y-2">
                  {items.map((row) => (
                    <MealDraftRow
                      key={row.key}
                      rowKey={row.key}
                      item={row}
                      /* A matched row shows its summary; only an unmatched one
                         needs the user to fill the numbers in. */
                      editable={false}
                      onChange={(patch) => update(row.key, patch)}
                      onRemove={() => remove(row.key)}
                    />
                  ))}
                </ul>

                <p className="text-muted-foreground tabular border-t pt-2 font-mono text-xs">
                  Total: {totals.kcal} kcal · P {totals.proteinG} g · C {totals.carbsG} g ·
                  F {totals.fatG} g
                </p>
              </div>

              {conflicts.length > 0 && (
                <AllergyWarning
                  allergens={[...new Set(conflicts.map((conflict) => conflict.allergen))]}
                />
              )}

              <FieldError message={fieldErrors.allergies} />
              <FieldError message={fieldErrors.items} />
              <FormError result={result} />

              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" disabled={pending}>
                  {pending ? "Saving…" : "Save meal"}
                </Button>
                <Button type="button" variant="ghost" onClick={reset}>
                  Clear
                </Button>
              </div>
            </>
          )}

          {items.length === 0 && text.trim().length > 0 && (
            <p className="text-muted-foreground text-xs">
              Nothing recognised in that yet. Try separating items with
              &ldquo;and&rdquo; or a comma.
            </p>
          )}
        </>
      )}
    </ActionForm>
  );
}

/**
 * The blocking warning.
 *
 * A checkbox rather than a confirm dialog, so the reason stays on screen while
 * the user decides. Unticked, the server refuses the save.
 */
function AllergyWarning({ allergens }: { allergens: string[] }) {
  return (
    <div
      role="alert"
      className="border-risk/35 bg-risk/5 flex items-start gap-3 rounded-lg border p-3"
    >
      <AlertTriangle className="text-risk mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium">
          This mentions {allergens.join(", ")}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          You listed{" "}
          {allergens.length === 1 ? "that" : "those"} as an allergy during setup. Nothing
          saves until you confirm.
        </p>
        <label className="mt-2 flex items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            name="confirmedAllergyWarning"
            value="true"
            className="accent-accent size-4"
          />
          Save it anyway — I know what is in this
        </label>
      </div>
    </div>
  );
}

/** Nearest meal by the hour, so the common case needs no change. */
function defaultMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "BREAKFAST";
  if (hour < 16) return "LUNCH";
  if (hour < 19) return "SNACK";
  return "DINNER";
}


export { MEAL_TYPES };
