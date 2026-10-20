"use client";

import { Pause, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "cn";
import type { RegreterTone } from "@/lib/domain/types";

const tones: { value: RegreterTone; label: string; sample: string }[] = [
  {
    value: "gentle",
    label: "Gentle",
    sample:
      "There are two hours left on this one, and it is due tomorrow. Want to start with twenty minutes?",
  },
  {
    value: "balanced",
    label: "Balanced",
    sample:
      "Two hours left, due tomorrow night. If it moves, tomorrow carries five and a half hours instead of four.",
  },
  {
    value: "direct",
    label: "Direct",
    sample:
      "This is the one thing with a deadline tomorrow. Postponing it pushes two other tasks to Thursday.",
  },
  {
    value: "no-mercy",
    label: "No mercy",
    sample:
      "Two hours, due tomorrow, 20% penalty if it is late. Tomorrow is already full. This is the decision.",
  },
];

const guardrails = [
  "Tone steps down automatically after you dismiss a few nudges.",
  "Never about food, weight or body — those are off limits for nudges.",
  "At most 3 nudges a day, and quiet hours are respected.",
  "Gentle mode is forced after several low-mood check-ins.",
  "It talks about the decision, never about you as a person.",
];

/**
 * The user picks the tone — the product never escalates on its own beyond the
 * level chosen, and the guardrails are visible rather than buried in settings.
 */
export function ToneSetting() {
  const [tone, setTone] = useState<RegreterTone>("balanced");
  const [paused, setPaused] = useState(false);

  const active = tones.find((option) => option.value === tone)!;

  return (
    <section
      aria-labelledby="tone-heading"
      className="bg-card shadow-card rounded-xl border p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="tone-heading" className="text-base font-semibold">
            How should it talk to you?
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            You choose the tone. Try each one — the words below are real examples.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="pause-nudges" className="text-xs">
            <Pause className="size-3.5" aria-hidden />
            Pause nudges
          </Label>
          <Switch
            id="pause-nudges"
            checked={paused}
            onCheckedChange={setPaused}
            aria-describedby="pause-help"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Tone">
        {tones.map((option) => (
          <Button
            key={option.value}
            variant={tone === option.value ? "default" : "outline"}
            size="sm"
            role="radio"
            aria-checked={tone === option.value}
            onClick={() => setTone(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <blockquote
        className={cn(
          "bg-muted/40 mt-4 rounded-lg border-l-2 px-3.5 py-3 text-sm",
          paused ? "border-muted-foreground opacity-60" : "border-primary",
        )}
      >
        {active.sample}
      </blockquote>

      <p id="pause-help" className="text-muted-foreground mt-2 text-2xs">
        {paused
          ? "Nudges are paused. The twin still answers when you ask it something."
          : "You can pause nudges at any time without losing your data."}
      </p>

      <div className="mt-4 border-t pt-3">
        <p className="flex items-center gap-1.5 text-xs font-medium">
          <ShieldCheck className="text-ok size-4" aria-hidden />
          Guardrails that always apply
        </p>
        <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
          {guardrails.map((rule) => (
            <li key={rule} className="flex gap-2">
              <span aria-hidden className="text-ok">
                •
              </span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
