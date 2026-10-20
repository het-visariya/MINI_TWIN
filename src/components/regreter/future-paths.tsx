"use client";

import { useState } from "react";

import { SimulationFrame } from "@/components/patterns/simulation-frame";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { cn } from "cn";
import type { ScenarioPath, Simulation } from "@/lib/domain/types";

const dials = [
  { id: "study", label: "Study hours a day", min: 0, max: 8, step: 0.5, value: 3 },
  { id: "gym", label: "Gym days a week", min: 0, max: 7, step: 1, value: 4 },
  { id: "sleep", label: "Sleep hours a night", min: 5, max: 10, step: 0.5, value: 7.5 },
  { id: "attendance", label: "Classes attended a week", min: 0, max: 20, step: 1, value: 16 },
];

/**
 * Two projected paths and the dials behind them. Everything here is labelled
 * as a simulation, and the numbers come from the user's own estimates.
 */
export function FuturePaths({ simulation }: { simulation: Simulation<ScenarioPath[]> }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(dials.map((dial) => [dial.id, dial.value])),
  );

  return (
    <SimulationFrame
      title="Future self — the next 7 days"
      assumptions={simulation.assumptions}
    >
      <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-4">
          {dials.map((dial) => (
            <div key={dial.id}>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <Label htmlFor={dial.id} className="text-xs">
                  {dial.label}
                </Label>
                <span className="tabular text-xs font-medium">{values[dial.id]}</span>
              </div>
              <Slider
                id={dial.id}
                min={dial.min}
                max={dial.max}
                step={dial.step}
                value={[values[dial.id]]}
                onValueChange={([next]) =>
                  setValues((previous) => ({ ...previous, [dial.id]: next }))
                }
              />
            </div>
          ))}
          <p className="text-muted-foreground text-2xs">
            Moving a dial changes the scenario below, not your actual plan.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {simulation.data.map((path, index) => (
            <article
              key={path.id}
              className={cn(
                "bg-card/70 rounded-lg border p-3.5",
                index === 0 ? "border-ok/35" : "border-attention/35",
              )}
            >
              <h4 className="text-sm font-medium">{path.label}</h4>
              <p className="text-muted-foreground mt-1 text-xs">{path.summary}</p>

              <ul className="mt-3 space-y-2.5">
                {path.outcomes.map((outcome) => (
                  <li key={outcome.domain}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                      <span>{outcome.label}</span>
                      <span className="tabular font-medium">{outcome.value}</span>
                    </div>
                    <Progress
                      value={outcome.value}
                      aria-label={`${path.label}, ${outcome.label}: projected ${outcome.value} out of 100`}
                    />
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </SimulationFrame>
  );
}
