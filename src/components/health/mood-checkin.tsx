"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/validation/shared";

const SCALE = [1, 2, 3, 4, 5] as const;

const MOOD_WORDS: Record<number, string> = {
  1: "Rough",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

const ENERGY_WORDS: Record<number, string> = {
  1: "Drained",
  2: "Tired",
  3: "Steady",
  4: "Fresh",
  5: "Buzzing",
};

/**
 * Mood and energy, in two taps.
 *
 * Deliberately small and deliberately optional. The check-in exists so the
 * user can later notice a pattern for themselves in the Life Graph; it does
 * **not** drive the twin's state, and nothing in the product responds to a low
 * day by asking the user to do more.
 *
 * One entry per day: coming back and tapping again edits today's rather than
 * stacking a second one, so the Life Graph gets one honest value per day.
 */
export function MoodCheckin({
  action,
  today,
  existing,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  today: string;
  existing: { mood: number; energy: number } | null;
}) {
  const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(existing?.energy ?? null);
  const [saved, setSaved] = useState(Boolean(existing));
  const [pending, startTransition] = useTransition();

  /* Saves itself as soon as both are chosen: a "save" button on a two-tap
     interaction makes it a three-tap interaction. */
  const choose = (next: { mood?: number; energy?: number }) => {
    const nextMood = next.mood ?? mood;
    const nextEnergy = next.energy ?? energy;

    if (next.mood !== undefined) setMood(next.mood);
    if (next.energy !== undefined) setEnergy(next.energy);

    if (nextMood === null || nextEnergy === null) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("date", today);
      formData.set("mood", String(nextMood));
      formData.set("energy", String(nextEnergy));

      const result = await action(formData);
      if (result.ok) setSaved(true);
      else toast.error(result.error);
    });
  };

  return (
    <section
      aria-labelledby="checkin-heading"
      className="bg-card shadow-card rounded-xl border p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="checkin-heading" className="text-base font-medium">
            Today&rsquo;s check-in
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Two taps, and only if you feel like it. Nothing here changes what your twin
            asks of you.
          </p>
        </div>
        {saved && !pending && (
          <span className="text-ok border-ok/35 bg-ok/10 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium">
            <Check className="size-3" aria-hidden />
            Saved
          </span>
        )}
      </div>

      <div className="mt-4 space-y-4">
        <Row
          legend="Mood"
          words={MOOD_WORDS}
          value={mood}
          disabled={pending}
          onPick={(value) => choose({ mood: value })}
        />
        <Row
          legend="Energy"
          words={ENERGY_WORDS}
          value={energy}
          disabled={pending}
          onPick={(value) => choose({ energy: value })}
        />
      </div>
    </section>
  );
}

function Row({
  legend,
  words,
  value,
  disabled,
  onPick,
}: {
  legend: string;
  words: Record<number, string>;
  value: number | null;
  disabled: boolean;
  onPick: (value: number) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-medium">{legend}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {SCALE.map((step) => (
          <Button
            key={step}
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-pressed={value === step}
            onClick={() => onPick(step)}
            className={cn(
              "min-w-[4.5rem] flex-col gap-0 py-1.5",
              value === step && "border-accent/50 bg-accent/10 text-accent",
            )}
          >
            {/* The number and the word both render, so the scale is never a
                row of coloured dots the user has to decode. */}
            <span className="tabular font-mono text-xs">{step}</span>
            <span className="text-2xs font-normal">{words[step]}</span>
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
