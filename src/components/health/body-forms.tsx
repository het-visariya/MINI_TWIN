"use client";

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
import type { ActivityLevel } from "@/lib/domain/calc/health";
import type { ActionResult } from "@/lib/validation/shared";

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; hint: string }[] = [
  { value: "SEDENTARY", label: "Mostly sitting", hint: "Desk or lectures, little walking" },
  { value: "LIGHT", label: "Lightly active", hint: "Some walking, the odd session" },
  { value: "MODERATE", label: "Moderately active", hint: "Training three or four days" },
  { value: "ACTIVE", label: "Active", hint: "Training most days" },
  { value: "VERY_ACTIVE", label: "Very active", hint: "Hard training, or a physical job" },
];

/**
 * Height and activity level.
 *
 * Note what is *not* here: no date of birth, no sex, no medical flag. Those
 * live on the profile the age gate and onboarding wrote, and the safety rules
 * read them from there. Offering them again on this screen would create a
 * second answer to "how old is this user?".
 */
export function HealthProfileForm({
  action,
  heightCm,
  activityLevel,
  plannedPerWeek,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  heightCm: number | null;
  activityLevel: ActivityLevel;
  plannedPerWeek: number;
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
            <h2 className="text-base font-medium">Your basics</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Used for the estimates on this screen and nowhere else.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="heightCm" className="text-xs">
                Height (cm)
              </Label>
              <Input
                id="heightCm"
                name="heightCm"
                type="number"
                inputMode="decimal"
                step="0.5"
                min={80}
                max={250}
                defaultValue={heightCm ?? ""}
                placeholder="172"
                aria-describedby={fieldErrors.heightCm ? "heightCm-error" : undefined}
              />
              <FieldError id="heightCm-error" message={fieldErrors.heightCm} />
            </div>

            <div>
              <Label htmlFor="activityLevel" className="text-xs">
                Activity level
              </Label>
              <Select name="activityLevel" defaultValue={activityLevel}>
                <SelectTrigger id="activityLevel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground mt-1 text-2xs">
                Changes the protein and energy estimates.
              </p>
            </div>

            <div>
              <Label htmlFor="plannedPerWeek" className="text-xs">
                Sessions a week you intend
              </Label>
              <Input
                id="plannedPerWeek"
                name="plannedPerWeek"
                type="number"
                inputMode="numeric"
                min={0}
                max={14}
                defaultValue={plannedPerWeek}
                aria-describedby="plannedPerWeek-hint"
              />
              <p id="plannedPerWeek-hint" className="text-muted-foreground mt-1 text-2xs">
                Consistency is measured against this — your number, not ours.
              </p>
              <FieldError message={fieldErrors.plannedPerWeek} />
            </div>
          </div>

          <FormError result={result} />

          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save basics"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

export function WeightForm({
  action,
  today,
  latestWeightKg,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  today: string;
  latestWeightKg: number | null;
}) {
  return (
    <ActionForm
      action={action}
      successMessage="Weight recorded."
      className="space-y-3"
    >
      {({ pending, fieldErrors, result }) => (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-32">
              <Label htmlFor="weight-date" className="text-xs">
                Date
              </Label>
              <Input
                id="weight-date"
                name="date"
                type="date"
                defaultValue={today}
                max={today}
                required
              />
            </div>
            <div className="w-32">
              <Label htmlFor="weightKg" className="text-xs">
                Weight (kg)
              </Label>
              <Input
                id="weightKg"
                name="weightKg"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={20}
                max={400}
                defaultValue={latestWeightKg ?? ""}
                required
                aria-describedby={fieldErrors.weightKg ? "weightKg-error" : undefined}
              />
            </div>
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Saving…" : "Record"}
            </Button>
          </div>

          <FieldError id="weightKg-error" message={fieldErrors.weightKg} />
          <FieldError message={fieldErrors.date} />
          <FormError result={result} />
          <p className="text-muted-foreground text-2xs">
            One entry a day. Recording the same day again replaces it.
          </p>
        </>
      )}
    </ActionForm>
  );
}

/**
 * Bedtime and wake time rather than a duration.
 *
 * The user knows when they went to bed; they do not know they slept 6h 48m.
 * The duration is derived on the server, including the common case of a night
 * that crosses midnight.
 */
export function SleepForm({
  action,
  today,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  today: string;
}) {
  return (
    <ActionForm action={action} successMessage="Sleep recorded." className="space-y-3">
      {({ pending, fieldErrors, result }) => (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-32">
              <Label htmlFor="sleep-date" className="text-xs">
                Night of
              </Label>
              <Input
                id="sleep-date"
                name="date"
                type="date"
                defaultValue={today}
                max={today}
                required
              />
            </div>
            <div className="w-28">
              <Label htmlFor="bedtime" className="text-xs">
                Bedtime
              </Label>
              <Input id="bedtime" name="bedtime" type="time" defaultValue="23:30" required />
            </div>
            <div className="w-28">
              <Label htmlFor="wakeTime" className="text-xs">
                Woke up
              </Label>
              <Input id="wakeTime" name="wakeTime" type="time" defaultValue="07:00" required />
            </div>
            <div className="w-28">
              <Label htmlFor="quality" className="text-xs">
                Quality
              </Label>
              <Select name="quality" defaultValue="3">
                <SelectTrigger id="quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Saving…" : "Record"}
            </Button>
          </div>

          <FieldError message={fieldErrors.minutes ?? fieldErrors._} />
          <FormError result={result} />
          <p className="text-muted-foreground text-2xs">
            A night that crosses midnight is handled — enter the times as they were.
          </p>
        </>
      )}
    </ActionForm>
  );
}
