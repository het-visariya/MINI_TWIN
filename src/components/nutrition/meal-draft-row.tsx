"use client";

import { CircleHelp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { DraftItem } from "@/lib/domain/calc/nutrition";

/**
 * One row of a meal before it is saved, however it was arrived at.
 *
 * Both ways of logging a meal end here: typing "2 rotis and dal", and
 * photographing the plate. They used to render their own markup, so the same
 * food looked like two different things depending on how it got on screen —
 * the typed path showed a one-line macro summary, the photo path showed four
 * input boxes and no summary. Reading your own log then meant translating
 * between two layouts.
 *
 * There is one layout now, and it is the typed one, because that is the
 * familiar shape. The photo path adds chips above it rather than replacing it.
 *
 * Keeping it in one component is also what keeps the hidden fields in step.
 * The server reads these rows as parallel arrays by field name, so a name that
 * drifts in one caller and not the other would silently misalign every row
 * after it — a bug that produces plausible, wrong macros rather than an error.
 */
export function MealDraftRow({
  item,
  rowKey,
  editable,
  chips,
  fromPhoto = false,
  onChange,
  onRemove,
}: {
  item: DraftItem;
  /** Unique within the list; only used to label the inputs for screen readers. */
  rowKey: number | string;
  /** Show the macro inputs. Always true for an unmatched or photo-read row. */
  editable: boolean;
  /** Rendered beside the title: "Estimate", a confidence band. */
  chips?: React.ReactNode;
  /** Marks the row as photo-derived for the action's provenance check. */
  fromPhoto?: boolean;
  onChange: (patch: Partial<DraftItem>) => void;
  onRemove: () => void;
}) {
  const unmatched = !item.matchedName;
  const showInputs = editable || unmatched;

  return (
    <li
      className={cn(
        "rounded-lg border p-2.5",
        /* The attention tone means "this one needs you", which is true of an
           unmatched row and of nothing else. A photo row is not alarming by
           virtue of being a photo row; its confidence chip says what it is. */
        unmatched ? "border-attention/35 bg-attention/5" : "bg-surface-2/50",
      )}
    >
      {/* Everything the server needs for this row. */}
      <input type="hidden" name="label" value={item.label} />
      <input type="hidden" name="foodId" value={item.foodId ?? ""} />
      <input type="hidden" name="quantity" value={item.quantity} />
      <input type="hidden" name="kcal" value={item.kcal} />
      <input type="hidden" name="proteinG" value={item.proteinG} />
      <input type="hidden" name="carbsG" value={item.carbsG} />
      <input type="hidden" name="fatG" value={item.fatG} />
      <input type="hidden" name="isEstimate" value={item.isEstimate ? "true" : ""} />
      {/* Sent for every row so the parallel arrays stay aligned: an input that
          appears on some rows and not others would shift the whole list. */}
      <input type="hidden" name="fromPhoto" value={fromPhoto ? "true" : ""} />

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {unmatched ? (
            <>
              <p className="text-attention flex items-center gap-1.5 text-sm font-medium">
                <CircleHelp className="size-3.5" aria-hidden />
                Couldn&rsquo;t match &mdash; add details
              </p>
              <p className="text-muted-foreground mt-0.5 text-2xs">
                &ldquo;{item.label}&rdquo; is not in the food table. Fill in what you know,
                or remove it.
              </p>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-medium">
                  {item.matchedName}
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    × {formatQuantity(item.quantity)}
                    {item.servingLabel ? ` (${item.servingLabel})` : ""}
                  </span>
                </p>
                {chips}
              </div>

              {/* The summary line, identical on both paths. */}
              <p className="text-muted-foreground tabular mt-0.5 font-mono text-2xs">
                {Math.round(item.kcal)} kcal · P {item.proteinG} · C {item.carbsG} · F{" "}
                {item.fatG}
                {item.isEstimate && <span className="font-sans"> · estimate</span>}
              </p>
            </>
          )}

          {showInputs && (
            <div className="mt-2 flex flex-wrap gap-2">
              {MACRO_FIELDS.map(([field, label]) => (
                <div key={field} className="w-20">
                  <Label htmlFor={`${field}-${rowKey}`} className="text-2xs">
                    {label}
                  </Label>
                  <Input
                    id={`${field}-${rowKey}`}
                    inputMode="decimal"
                    value={item[field] || ""}
                    onChange={(event) =>
                      onChange({ [field]: Number(event.target.value) || 0 } as Partial<DraftItem>)
                    }
                    className="tabular font-mono"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={`Remove ${item.matchedName ?? item.label}`}
        >
          <X aria-hidden />
        </Button>
      </div>
    </li>
  );
}

const MACRO_FIELDS = [
  ["kcal", "kcal"],
  ["proteinG", "Protein g"],
  ["carbsG", "Carbs g"],
  ["fatG", "Fat g"],
] as const;

export function formatQuantity(quantity: number): string {
  if (quantity === 0.5) return "½";
  if (quantity === 0.25) return "¼";
  return String(quantity);
}
