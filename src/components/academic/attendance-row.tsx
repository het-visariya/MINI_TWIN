"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AskAboutThis } from "@/components/patterns/ask-about-this";
import { StatusChip } from "@/components/patterns/status-chip";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Status } from "@/lib/domain/types";

type Subject = {
  id: string;
  name: string;
  credits: number;
  difficulty: "high" | "medium" | "low";
  attendance: { attended: number; held: number; required: number };
  grade: { expected: string; internal: number; internalMax: number };
};

/**
 * The bunk budget: how many classes can still be missed, and how many are
 * needed to recover. Both are arithmetic on the user's own attendance against
 * the requirement they entered — stated plainly, with no judgement attached.
 */
function bunkBudget({ attended, held, required }: Subject["attendance"]) {
  const percent = (attended / held) * 100;
  const ratio = required / 100;

  // Classes that can be missed while staying at or above the requirement.
  const canMiss = Math.max(0, Math.floor(attended / ratio - held));

  // Consecutive classes needed to climb back to the requirement.
  let needed = 0;
  while ((attended + needed) / (held + needed) < ratio && needed < 60) {
    needed += 1;
  }

  const band: Status = percent >= required + 8 ? "ok" : percent >= required ? "attention" : "risk";

  return { percent, canMiss, needed, band };
}

export function AttendanceRow({ subject }: { subject: Subject }) {
  const [marked, setMarked] = useState<"present" | "absent" | null>(null);
  const { percent, canMiss, needed, band } = bunkBudget(subject.attendance);

  const mark = (value: "present" | "absent") => {
    setMarked(value);
    toast.success(`Marked ${value} for ${subject.name}`, {
      description: "Nothing is saved in this preview build.",
    });
  };

  return (
    <article className="bg-card shadow-card rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">{subject.name}</h3>
            <StatusChip kind={band}>
              {percent.toFixed(0)}% attendance
            </StatusChip>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {subject.credits} credits · {subject.difficulty} difficulty · internals{" "}
            <span className="tabular text-foreground">
              {subject.grade.internal}/{subject.grade.internalMax}
            </span>{" "}
            · expected{" "}
            <span className="text-foreground font-medium">{subject.grade.expected}</span>
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant={marked === "present" ? "default" : "outline"}
            size="sm"
            onClick={() => mark("present")}
            aria-pressed={marked === "present"}
          >
            <Check aria-hidden />
            Present
          </Button>
          <Button
            variant={marked === "absent" ? "destructive" : "outline"}
            size="sm"
            onClick={() => mark("absent")}
            aria-pressed={marked === "absent"}
          >
            <X aria-hidden />
            Absent
          </Button>
          <AskAboutThis subject={`${subject.name} attendance`} />
        </div>
      </div>

      <Progress
        value={percent}
        className="mt-3"
        aria-label={`${subject.name} attendance: ${percent.toFixed(0)} percent, requirement ${subject.attendance.required} percent`}
      />

      <dl className="text-muted-foreground mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <div className="flex justify-between gap-2">
          <dt>Attended</dt>
          <dd className="tabular text-foreground">
            {subject.attendance.attended}/{subject.attendance.held}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Requirement</dt>
          <dd className="tabular text-foreground">{subject.attendance.required}%</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Can still miss</dt>
          <dd className="tabular text-foreground">{canMiss}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>To recover</dt>
          <dd className="tabular text-foreground">
            {needed === 0 ? "—" : `${needed} classes`}
          </dd>
        </div>
      </dl>
    </article>
  );
}
