"use client";

import { AlertTriangle, Camera, Loader2, RotateCw, X } from "lucide-react";
import { useRef, useState } from "react";

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
import { MEAL_TYPES } from "@/components/nutrition/meal-composer";
import { confidenceLabel, type PhotoDraftItem } from "@/lib/domain/calc/food-vision";
import { allergyConflicts, dailyTotals } from "@/lib/domain/calc/nutrition";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/validation/shared";

/** The bucket caps objects at 2 MB; aim comfortably under it. */
const TARGET_BYTES = 1_500_000;
const MAX_EDGE = 1280;

type Row = PhotoDraftItem & { key: number };

type Stage =
  | { name: "idle" }
  | { name: "preview"; file: Blob; url: string; rotation: number }
  | { name: "analyzing" }
  | { name: "failed"; message: string }
  | {
      name: "confirm";
      mealPhotoId: string;
      rows: Row[];
      assumptions: string[];
      unreliable: boolean;
      url: string;
    };

/**
 * Log a meal from a photograph.
 *
 * The flow is capture → preview → analyse → **confirm** → save, and the
 * confirm step is the one that matters. Nothing the model said reaches the
 * user's log until they have seen each row, with its confidence and an
 * "Estimate" label, and pressed save. The save itself goes through the same
 * `logMeal` action the typed composer uses, which means the allergy refusal
 * and the server-side validation are literally the same code — not a parallel
 * implementation that could drift out of agreement with it.
 *
 * Three deliberate choices:
 *
 *   - **Compression happens here, in the browser.** A phone photo is 3–6 MB
 *     and the interesting content survives 1280px easily. Sending the full
 *     file would cost the user their data allowance for no better reading.
 *   - **Rotation is baked into the bytes**, not applied as a CSS transform, so
 *     what the model sees is what the user saw.
 *   - **A failure always offers typing.** The manual composer is never blocked
 *     by the camera path failing; that is the entire fallback story.
 */
export function MealPhotoCapture({
  action,
  today,
  allergies,
}: {
  action: (formData: FormData) => Promise<ActionResult<{ id: string }>>;
  today: string;
  allergies: string[];
}) {
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const input = useRef<HTMLInputElement>(null);

  const reset = () => {
    if (stage.name === "preview") URL.revokeObjectURL(stage.url);
    setStage({ name: "idle" });
    if (input.current) input.current.value = "";
  };

  async function pick(file: File) {
    const shrunk = await compress(file, 0);
    setStage({
      name: "preview",
      file: shrunk,
      url: URL.createObjectURL(shrunk),
      rotation: 0,
    });
  }

  async function rotate() {
    if (stage.name !== "preview") return;

    const rotation = (stage.rotation + 90) % 360;
    const rotated = await compress(stage.file, 90);

    URL.revokeObjectURL(stage.url);
    setStage({
      name: "preview",
      file: rotated,
      url: URL.createObjectURL(rotated),
      rotation,
    });
  }

  async function analyze() {
    if (stage.name !== "preview") return;

    const previewUrl = stage.url;
    const body = new FormData();
    body.set("photo", new File([stage.file], "meal.jpg", { type: "image/jpeg" }));

    setStage({ name: "analyzing" });

    try {
      const response = await fetch("/api/nutrition/analyze", { method: "POST", body });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        mealPhotoId?: string;
        draft?: { items: PhotoDraftItem[]; assumptions: string[]; unreliable: boolean };
      };

      if (!payload.ok || !payload.draft || !payload.mealPhotoId) {
        setStage({
          name: "failed",
          message: payload.error ?? "Couldn't read this clearly — add it manually?",
        });
        return;
      }

      setStage({
        name: "confirm",
        mealPhotoId: payload.mealPhotoId,
        rows: payload.draft.items.map((item, index) => ({ ...item, key: index })),
        assumptions: payload.draft.assumptions,
        unreliable: payload.draft.unreliable,
        url: previewUrl,
      });
    } catch {
      setStage({
        name: "failed",
        message: "That didn't reach the server. Check your connection, or type the meal in.",
      });
    }
  }

  /* ---------------------------------------------------------------------- */

  if (stage.name === "confirm") {
    return (
      <ConfirmCard
        action={action}
        today={today}
        allergies={allergies}
        stage={stage}
        setRows={(rows) => setStage({ ...stage, rows })}
        onCancel={reset}
      />
    );
  }

  return (
    <div className="bg-card shadow-card space-y-3 rounded-xl border p-4">
      <div>
        <h2 className="text-base font-medium">Log a meal from a photo</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Point your camera at the plate. Every number from a photo is an estimate, and
          nothing saves until you check it.
        </p>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void pick(file);
        }}
      />

      {stage.name === "idle" && (
        <Button type="button" variant="secondary" onClick={() => input.current?.click()}>
          <Camera aria-hidden />
          Take or choose a photo
        </Button>
      )}

      {stage.name === "preview" && (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL
              from the user's own camera; next/image cannot optimise it and
              would only add a loader in front of a local object URL. */}
          <img
            src={stage.url}
            alt="The photo you just took, ready to read"
            className="max-h-64 w-full rounded-lg border object-contain"
          />

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" onClick={() => void analyze()}>
              Read this photo
            </Button>
            <Button type="button" variant="ghost" onClick={() => void rotate()}>
              <RotateCw aria-hidden />
              Rotate
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {stage.name === "analyzing" && (
        <p
          className="text-muted-foreground flex items-center gap-2 text-sm"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Reading the photo…
        </p>
      )}

      {stage.name === "failed" && (
        <div className="space-y-2" role="status" aria-live="polite">
          <p className="text-attention text-sm">{stage.message}</p>
          <p className="text-muted-foreground text-xs">
            Typing it in works just as well — the composer below takes
            &ldquo;2 rotis and dal&rdquo;.
          </p>
          <Button type="button" variant="ghost" onClick={reset}>
            Try another photo
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * The confirm step.
 *
 * Every row is editable, carries a confidence chip and says "Estimate" — the
 * label is not conditional on confidence, because a high-confidence guess from
 * a photograph is still a guess.
 */
function ConfirmCard({
  action,
  today,
  allergies,
  stage,
  setRows,
  onCancel,
}: {
  action: (formData: FormData) => Promise<ActionResult<{ id: string }>>;
  today: string;
  allergies: string[];
  stage: Extract<Stage, { name: "confirm" }>;
  setRows: (rows: Row[]) => void;
  onCancel: () => void;
}) {
  const { rows } = stage;
  const totals = dailyTotals(rows);
  const conflicts = allergyConflicts(rows, allergies);
  const allergens = [...new Set(conflicts.map((conflict) => conflict.allergen))];

  const update = (key: number, patch: Partial<Row>) =>
    setRows(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <ActionForm
      action={action}
      successMessage="Meal logged from the photo."
      className="bg-card shadow-card space-y-4 rounded-xl border p-4"
      onSuccess={onCancel}
    >
      {({ pending, fieldErrors, result }) => (
        <>
          <input type="hidden" name="mealPhotoId" value={stage.mealPhotoId} />

          <div>
            <h2 className="text-base font-medium">Check what your twin saw</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              These are estimates read off the photo. Correct anything that is wrong —
              nothing is saved yet.
            </p>
          </div>

          {stage.unreliable && (
            <p
              className="border-attention/35 bg-attention/5 text-attention rounded-lg border p-2.5 text-xs"
              role="status"
            >
              Couldn&rsquo;t read this clearly. Check every row carefully, or cancel and type
              the meal in instead.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div className="w-32">
              <Label htmlFor="photo-mealType" className="text-xs">
                Meal
              </Label>
              <Select name="mealType" defaultValue={defaultMealType()}>
                <SelectTrigger id="photo-mealType">
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
              <Label htmlFor="photo-date" className="text-xs">
                Date
              </Label>
              <Input
                id="photo-date"
                name="date"
                type="date"
                defaultValue={today}
                max={today}
                required
              />
            </div>
          </div>

          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.key}
                className={cn(
                  "rounded-lg border p-2.5",
                  row.lowConfidence ? "border-attention/35 bg-attention/5" : "bg-surface-2/50",
                )}
              >
                <input type="hidden" name="label" value={row.label} />
                <input type="hidden" name="foodId" value={row.foodId ?? ""} />
                <input type="hidden" name="quantity" value={row.quantity} />
                <input type="hidden" name="kcal" value={row.kcal} />
                <input type="hidden" name="proteinG" value={row.proteinG} />
                <input type="hidden" name="carbsG" value={row.carbsG} />
                <input type="hidden" name="fatG" value={row.fatG} />
                {/* Always an estimate, and always photo-derived. The server
                    re-derives both rather than trusting these. */}
                <input type="hidden" name="isEstimate" value="true" />
                <input type="hidden" name="fromPhoto" value="true" />

                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-medium">{row.label}</p>
                      <span className="bg-surface-3 text-muted-foreground rounded px-1.5 py-0.5 text-2xs font-medium">
                        Estimate
                      </span>
                      <span
                        className="text-muted-foreground rounded border px-1.5 py-0.5 text-2xs"
                        title={`The model's confidence in this row: ${Math.round(
                          row.confidence * 100,
                        )}%`}
                      >
                        {confidenceLabel(row.confidence)} confidence
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {(
                        [
                          ["kcal", "kcal"],
                          ["proteinG", "Protein g"],
                          ["carbsG", "Carbs g"],
                          ["fatG", "Fat g"],
                        ] as const
                      ).map(([field, label]) => (
                        <div key={field} className="w-20">
                          <Label htmlFor={`photo-${field}-${row.key}`} className="text-2xs">
                            {label}
                          </Label>
                          <Input
                            id={`photo-${field}-${row.key}`}
                            inputMode="decimal"
                            value={row[field] || ""}
                            onChange={(event) =>
                              update(row.key, {
                                [field]: Number(event.target.value) || 0,
                              } as Partial<Row>)
                            }
                            className="tabular font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setRows(rows.filter((other) => other.key !== row.key))}
                    aria-label={`Remove ${row.label}`}
                  >
                    <X aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {rows.length === 0 && (
            <p className="text-muted-foreground text-xs">
              Nothing left to save. Cancel and type the meal in instead.
            </p>
          )}

          {stage.assumptions.length > 0 && (
            <div className="text-muted-foreground border-t pt-2 text-2xs">
              <p className="font-medium">What it assumed</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {stage.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-muted-foreground tabular border-t pt-2 font-mono text-xs">
            Total: {totals.kcal} kcal · P {totals.proteinG} g · C {totals.carbsG} g · F{" "}
            {totals.fatG} g
          </p>

          {allergens.length > 0 && <PhotoAllergyWarning allergens={allergens} />}

          <FieldError message={fieldErrors.allergies} />
          <FieldError message={fieldErrors.items} />
          <FormError result={result} />

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={pending || rows.length === 0}
            >
              {pending ? "Saving…" : "Save these estimates"}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/**
 * The allergy block on the photo path.
 *
 * Worded more cautiously than the typed one on purpose: the user typed the
 * words in that case, where here a model named the dish and may have named it
 * wrong. The server refuses the save either way until the box is ticked.
 */
function PhotoAllergyWarning({ allergens }: { allergens: string[] }) {
  return (
    <div
      role="alert"
      className="border-risk/35 bg-risk/5 flex items-start gap-3 rounded-lg border p-3"
    >
      <AlertTriangle className="text-risk mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium">
          This photo may contain {allergens.join(", ")}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          You listed {allergens.length === 1 ? "that" : "those"} as an allergy. A photo is
          read by a model and can be wrong in either direction — check the plate itself,
          not this reading.
        </p>
        <label className="mt-2 flex items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            name="confirmedAllergyWarning"
            value="true"
            className="accent-accent size-4"
          />
          I have checked — save it anyway
        </label>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               image handling                               */
/* -------------------------------------------------------------------------- */

/**
 * Shrink, optionally rotate, and re-encode as JPEG.
 *
 * Quality is stepped down until the result fits rather than guessed at once:
 * how well a photo compresses depends on the photo, and a fixed quality either
 * overshoots the budget on a busy plate or wastes it on a plain one.
 *
 * Returns the original when the browser cannot decode it; the server's own
 * size and type checks are the backstop, so a failure here degrades to
 * "uploads the original" instead of blocking the user.
 */
async function compress(file: Blob, rotateDegrees: number): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);

    const swap = rotateDegrees === 90 || rotateDegrees === 270;
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = swap ? height : width;
    canvas.height = swap ? width : height;

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((rotateDegrees * Math.PI) / 180);
    context.drawImage(bitmap, -width / 2, -height / 2, width, height);
    bitmap.close();

    for (const quality of [0.82, 0.7, 0.58, 0.45]) {
      const blob = await toBlob(canvas, quality);
      if (!blob) break;
      if (blob.size <= TARGET_BYTES) return blob;
    }

    /* Still over budget at the lowest quality we are willing to use: send it
       anyway and let the server's 413 speak, rather than degrading the image
       to the point where the model cannot read the plate. */
    return (await toBlob(canvas, 0.45)) ?? file;
  } catch {
    return file;
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Nearest meal by the hour, so the common case needs no change. */
function defaultMealType() {
  const hour = new Date().getHours();
  if (hour < 11) return "BREAKFAST";
  if (hour < 16) return "LUNCH";
  if (hour < 19) return "SNACK";
  return "DINNER";
}
