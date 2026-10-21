"use client";

import { Minus, Plus, Repeat, Trophy, X } from "lucide-react";
import { useMemo, useState } from "react";

import { ActionForm, FieldError, FormError } from "@/components/patterns/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";
import { epleyOneRepMax, type PersonalRecord } from "@/lib/domain/calc/health";
import type { ActionResult } from "@/lib/validation/shared";

type Row = { key: number; exercise: string; reps: string; weightKg: string };

/**
 * Fast set entry.
 *
 * Designed around what actually happens in a gym: the user is standing up,
 * holding a phone, between sets. So the exercise is typed once and carried
 * down the rows, "repeat last set" is one tap, and reps and weight have
 * steppers either side of the field because typing a number into a tiny input
 * with sweaty hands is the slow path.
 *
 * The PR badge is computed as you type, from the bests passed in by the
 * server, so beating a record is visible before the set is even saved.
 */
export function WorkoutLogger({
  action,
  today,
  exerciseHistory,
  personalRecords,
}: {
  action: (formData: FormData) => Promise<ActionResult<{ id: string }>>;
  /** yyyy-mm-dd, computed on the server so there is no hydration mismatch. */
  today: string;
  exerciseHistory: string[];
  personalRecords: PersonalRecord[];
}) {
  const [rows, setRows] = useState<Row[]>([
    { key: 0, exercise: "", reps: "8", weightKg: "20" },
  ]);

  const bests = useMemo(() => {
    const map = new Map<string, PersonalRecord>();
    for (const record of personalRecords) map.set(record.exercise, record);
    return map;
  }, [personalRecords]);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  const addRow = () =>
    setRows((current) => {
      const last = current[current.length - 1];
      return [
        ...current,
        {
          key: Date.now(),
          /* The exercise carries down: a session is usually three sets of the
             same lift, not three different ones. */
          exercise: last?.exercise ?? "",
          reps: last?.reps ?? "8",
          weightKg: last?.weightKg ?? "20",
        },
      ];
    });

  const repeatLast = () => {
    const last = rows[rows.length - 1];
    if (!last) return;
    setRows((current) => [...current, { ...last, key: Date.now() }]);
  };

  const removeRow = (key: number) =>
    setRows((current) =>
      current.length === 1 ? current : current.filter((row) => row.key !== key),
    );

  /** Does this row beat the stored best for its exercise? */
  const isRecord = (row: Row) => {
    const name = row.exercise.trim().toLowerCase();
    if (!name) return false;

    const weight = Number(row.weightKg);
    const reps = Number(row.reps);
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(reps) || reps <= 0) {
      return false;
    }

    const best = bests.get(name);
    if (!best) return true;

    return (
      weight > best.bestWeightKg ||
      epleyOneRepMax(weight, reps) > best.estimatedOneRepMaxKg
    );
  };

  return (
    <ActionForm
      action={action}
      successMessage="Workout saved."
      className="bg-card shadow-card space-y-4 rounded-xl border p-4"
      onSuccess={() => setRows([{ key: Date.now(), exercise: "", reps: "8", weightKg: "20" }])}
    >
      {({ pending, fieldErrors, result }) => (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-medium">Log a workout</h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Sets as you do them. The order you enter is the order they are saved in.
              </p>
            </div>

            <div className="w-36">
              <Label htmlFor="workout-date" className="text-xs">
                Date
              </Label>
              <Input
                id="workout-date"
                name="date"
                type="date"
                defaultValue={today}
                max={today}
                required
                aria-describedby={fieldErrors.date ? "workout-date-error" : undefined}
              />
              <FieldError id="workout-date-error" message={fieldErrors.date} />
            </div>
          </div>

          {/* One datalist for every row: the browser reuses it by id. */}
          <datalist id="exercise-history">
            {exerciseHistory.map((exercise) => (
              <option key={exercise} value={exercise} />
            ))}
          </datalist>

          <ul className="space-y-2">
            {rows.map((row, index) => {
              const record = isRecord(row);

              return (
                <li
                  key={row.key}
                  className="bg-surface-2/50 flex flex-wrap items-end gap-2 rounded-lg border p-2.5"
                >
                  <div className="min-w-[9rem] flex-1">
                    <Label htmlFor={`exercise-${row.key}`} className="text-2xs">
                      Exercise
                    </Label>
                    <Input
                      id={`exercise-${row.key}`}
                      name="exercise"
                      list="exercise-history"
                      value={row.exercise}
                      onChange={(event) =>
                        update(row.key, { exercise: event.target.value })
                      }
                      placeholder="Squat"
                      autoComplete="off"
                      required
                    />
                  </div>

                  <Stepper
                    id={`reps-${row.key}`}
                    label="Reps"
                    name="reps"
                    value={row.reps}
                    step={1}
                    min={1}
                    onChange={(value) => update(row.key, { reps: value })}
                  />

                  <Stepper
                    id={`weight-${row.key}`}
                    label="Weight (kg)"
                    name="weightKg"
                    value={row.weightKg}
                    step={2.5}
                    min={0}
                    onChange={(value) => update(row.key, { weightKg: value })}
                  />

                  <div className="flex items-center gap-1 pb-0.5">
                    {record && (
                      <span className="text-accent border-accent/40 bg-accent/10 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium">
                        <Trophy className="size-3" aria-hidden />
                        PR
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(row.key)}
                      disabled={rows.length === 1}
                      aria-label={`Remove set ${index + 1}`}
                    >
                      <X aria-hidden />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus aria-hidden />
              Add set
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={repeatLast}
              disabled={rows.length === 0}
            >
              <Repeat aria-hidden />
              Repeat last set
            </Button>
          </div>

          <div>
            <Label htmlFor="workout-notes" className="text-xs">
              Notes <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="workout-notes"
              name="notes"
              rows={2}
              placeholder="How it felt, anything that hurt, what to change next time."
            />
          </div>

          <FieldError message={fieldErrors.sets} />
          <FormError result={result} />

          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save workout"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

/**
 * A number field with a button either side.
 *
 * The input keeps `inputMode="decimal"` so a phone still offers a numeric
 * keypad for the cases where typing is faster than tapping.
 */
function Stepper({
  id,
  label,
  name,
  value,
  step,
  min,
  onChange,
  className,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  step: number;
  min: number;
  onChange: (value: string) => void;
  className?: string;
}) {
  const nudge = (direction: 1 | -1) => {
    const current = Number(value);
    const base = Number.isFinite(current) ? current : min;
    const next = Math.max(min, base + direction * step);
    /* Trailing ".0" on a whole number reads as false precision. */
    onChange(Number.isInteger(next) ? String(next) : next.toFixed(1));
  };

  return (
    <div className={cn("w-[8.5rem]", className)}>
      <Label htmlFor={id} className="text-2xs">
        {label}
      </Label>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => nudge(-1)}
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          <Minus aria-hidden />
        </Button>
        <Input
          id={id}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="decimal"
          className="tabular text-center font-mono"
          required
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => nudge(1)}
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          <Plus aria-hidden />
        </Button>
      </div>
    </div>
  );
}
