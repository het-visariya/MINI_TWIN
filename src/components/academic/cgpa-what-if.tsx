"use client";

import { useState } from "react";

import { NumberFlow } from "@/components/motion/number-flow";
import { SimulationFrame } from "@/components/patterns/simulation-frame";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Simulation } from "@/lib/domain/types";

/** Grade points for the scheme the user entered during onboarding. */
const gradePoints: Record<string, number> = {
  "A+": 10,
  A: 9,
  "A-": 8.5,
  "B+": 8,
  B: 7,
  "B-": 6.5,
  C: 6,
  D: 5,
};

const gradeOptions = Object.keys(gradePoints);

type CgpaData = {
  current: number;
  projected: number;
  perSubject: { name: string; expected: string; credits: number }[];
};

/**
 * CGPA what-if. The user chooses expected grades and sees the projection —
 * these are the grades they selected, never grades the twin predicted.
 */
export function CgpaWhatIf({ simulation }: { simulation: Simulation<CgpaData> }) {
  const [grades, setGrades] = useState(() =>
    Object.fromEntries(
      simulation.data.perSubject.map((subject) => [subject.name, subject.expected]),
    ),
  );

  const totalCredits = simulation.data.perSubject.reduce(
    (sum, subject) => sum + subject.credits,
    0,
  );
  const projected =
    simulation.data.perSubject.reduce(
      (sum, subject) => sum + gradePoints[grades[subject.name]] * subject.credits,
      0,
    ) / totalCredits;

  return (
    <SimulationFrame title="CGPA what-if" assumptions={simulation.assumptions}>
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="space-y-3">
          {simulation.data.perSubject.map((subject) => (
            <div
              key={subject.name}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <Label htmlFor={`grade-${subject.name}`} className="text-sm">
                {subject.name}
                <span className="text-muted-foreground ml-1.5 text-xs">
                  {subject.credits} credits
                </span>
              </Label>
              <Select
                value={grades[subject.name]}
                onValueChange={(value) =>
                  setGrades((previous) => ({ ...previous, [subject.name]: value }))
                }
              >
                <SelectTrigger id={`grade-${subject.name}`} className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {gradeOptions.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className="bg-card/70 flex gap-6 rounded-lg border p-4">
          <div>
            <p className="text-muted-foreground text-xs">Current</p>
            <p className="tabular mt-1 text-xl font-semibold">
              {simulation.data.current.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">
              Projected on these grades
            </p>
            <NumberFlow
              value={projected}
              precision={2}
              className="text-primary mt-1 block text-xl font-semibold"
            />
          </div>
        </div>
      </div>
    </SimulationFrame>
  );
}
