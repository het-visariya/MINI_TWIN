"use client";

import { ArrowRight, Check, Minus, TrendingDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DomainIcon } from "@/components/patterns/domain-icon";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import type { Consequence, Effect } from "@/lib/domain/types";

const directionIcon = {
  better: Check,
  worse: TrendingDown,
  neutral: Minus,
} as const;

const directionTone = {
  better: "text-ok",
  worse: "text-risk",
  neutral: "text-muted-foreground",
} as const;

function EffectRow({ effect }: { effect: Effect }) {
  const Icon = directionIcon[effect.direction];

  return (
    <li className="flex items-start gap-2 text-xs">
      <Icon
        className={cn("mt-0.5 size-3.5 shrink-0", directionTone[effect.direction])}
        aria-hidden
      />
      <span className="text-muted-foreground">
        <span className="sr-only">{effect.direction}: </span>
        {effect.statement}
      </span>
    </li>
  );
}

/**
 * Two options with their stated trade-offs, side by side.
 *
 * This is the shape Regret Preview, "Fix my day" and plan negotiation all use.
 * It consumes consequences calculated elsewhere — it never invents a penalty to
 * push the user, and the user is the one who chooses.
 */
export function ConsequenceCard({
  consequence,
  onChoose,
  className,
}: {
  consequence: Consequence;
  onChoose?: (optionId: string) => void;
  className?: string;
}) {
  const [chosen, setChosen] = useState<string | null>(null);

  const choose = (optionId: string, label: string) => {
    setChosen(optionId);
    onChoose?.(optionId);
    toast.success(`Chosen: ${label}`, {
      description: "Nothing is saved in this preview build.",
    });
  };

  return (
    <div
      className={cn(
        "bg-card text-card-foreground shadow-card rounded-xl border p-4",
        className,
      )}
    >
      <p className="text-sm font-medium">{consequence.question}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {consequence.options.map((option) => {
          const isChosen = chosen === option.id;

          return (
            <div
              key={option.id}
              className={cn(
                "flex flex-col gap-3 rounded-lg border p-3 transition-colors",
                option.recommended ? "border-primary/40 bg-primary/5" : "bg-muted/30",
                isChosen && "ring-ring ring-2",
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{option.label}</p>
                  {option.recommended && (
                    <span className="text-primary bg-primary/10 rounded-full px-2 py-0.5 text-2xs font-medium">
                      Suggested
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">{option.cost}</p>
              </div>

              <ul className="space-y-1.5">
                {option.effects.map((effect) => (
                  <EffectRow key={effect.statement} effect={effect} />
                ))}
              </ul>

              <div className="mt-auto flex flex-wrap gap-1.5">
                {[...new Set(option.effects.map((effect) => effect.domain))].map(
                  (domain) => (
                    <DomainIcon key={domain} domain={domain} withLabel />
                  ),
                )}
              </div>

              <Button
                variant={option.recommended ? "default" : "outline"}
                onClick={() => choose(option.id, option.label)}
                aria-pressed={isChosen}
              >
                {isChosen ? "Chosen" : "Choose this"}
                {!isChosen && <ArrowRight aria-hidden />}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t pt-3">
        <p className="text-xs font-medium">These figures assume</p>
        <ul className="text-muted-foreground mt-1.5 space-y-1 text-xs">
          {consequence.assumptions.map((assumption) => (
            <li key={assumption} className="flex gap-2">
              <span aria-hidden className="text-primary">
                •
              </span>
              <span>{assumption}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
