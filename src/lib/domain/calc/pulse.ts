/**
 * The five Twin Pulse scores, and Momentum.
 *
 * One implementation, two callers: Home renders these live, and the daily
 * snapshot job stores them so a trend exists later. Writing the arithmetic
 * twice is how the number on Home and the number in the Insights sparkline
 * start disagreeing, and nobody can say which is right.
 *
 * Pure: no Prisma, no React, no clock beyond the `now` passed in.
 *
 * The rule that shapes every function here: **a score with no data is `null`,
 * not zero.** Zero reads as "you did badly"; absent reads as "nothing to
 * measure yet", which is the truth for a new account. Momentum is the mean of
 * whatever scores exist, and is itself null until at least two do.
 */

import type { Score, Status } from "@/lib/domain/types";

export type PulseInputs = {
  /** Attendance against the rule, plus assignments past their date. */
  academic?: {
    attendancePct: number | null;
    requiredPct: number;
    overdueTasks: number;
  } | null;

  /** Sessions kept against the user's own planned count. */
  fitness?: { kept: number; planned: number } | null;

  /** Tasks closed and tasks left past their deadline, over seven days. */
  productivity?: { completed: number; overdue: number; open: number } | null;

  /** Skill-gap readiness and roadmap completion, both 0–1. */
  career?: { readiness: number | null; roadmapRatio: number | null } | null;

  /** Sleep recorded and habits kept — the day's scaffolding. */
  routine?: {
    nightsLogged: number;
    averageSleepMinutes: number;
    habitRatio: number | null;
  } | null;
};

export type PulseResult = {
  /** Only the scores that could be computed, in display order. */
  scores: Score[];
  /** Null until at least two scores exist to average. */
  momentum: Score | null;
};

/** Bands are the same four the rest of the product uses. */
export function bandFor(value: number): Status {
  if (value >= 70) return "ok";
  if (value >= 45) return "attention";
  return "risk";
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/* -------------------------------------------------------------------------- */
/*                               the five scores                              */
/* -------------------------------------------------------------------------- */

function academicScore(input: NonNullable<PulseInputs["academic"]>): Score | null {
  if (input.attendancePct === null && input.overdueTasks === 0) return null;

  /* Attendance is scored against the user's own rule, not against 100%:
     meeting a 75% requirement exactly is a pass, not a C. */
  const attendancePart =
    input.attendancePct === null
      ? null
      : clamp((input.attendancePct / Math.max(input.requiredPct, 1)) * 85);

  /* Each overdue assignment costs 12 points, floored at a 40-point penalty so
     a bad fortnight does not read as total failure. */
  const overduePenalty = Math.min(40, input.overdueTasks * 12);

  const base = attendancePart ?? 70;
  const value = clamp(base - overduePenalty);

  return {
    id: "s-academic",
    label: "Academic",
    domain: "academic",
    value,
    band: bandFor(value),
    meaning:
      input.attendancePct === null
        ? `You have ${input.overdueTasks} assignment${
            input.overdueTasks === 1 ? "" : "s"
          } past its date. Add subjects and attendance for the full picture.`
        : `Attendance is ${Math.round(input.attendancePct)}% against your ${
            input.requiredPct
          }% rule${
            input.overdueTasks > 0
              ? `, with ${input.overdueTasks} assignment${
                  input.overdueTasks === 1 ? "" : "s"
                } past its date`
              : ""
          }.`,
    inputs: ["Attendance against your own rule", "Assignments past their deadline"],
  };
}

function fitnessScore(input: NonNullable<PulseInputs["fitness"]>): Score | null {
  if (input.planned <= 0) return null;

  const value = clamp((Math.min(input.kept, input.planned) / input.planned) * 100);

  return {
    id: "s-fitness",
    label: "Fitness",
    domain: "health",
    value,
    band: bandFor(value),
    meaning: `${input.kept} of the ${input.planned} sessions you planned this week. Compared with your own plan, nobody else's.`,
    inputs: ["Sessions logged this week", "Sessions a week you said you intend"],
  };
}

function productivityScore(
  input: NonNullable<PulseInputs["productivity"]>,
): Score | null {
  if (input.completed === 0 && input.open === 0 && input.overdue === 0) return null;

  const closable = input.completed + input.overdue;
  const completionPart =
    closable === 0 ? 65 : clamp((input.completed / closable) * 100);

  const overduePenalty = Math.min(30, input.overdue * 8);
  const value = clamp(completionPart - overduePenalty);

  return {
    id: "s-productivity",
    label: "Productivity",
    domain: "productivity",
    value,
    band: bandFor(value),
    meaning: `${input.completed} task${
      input.completed === 1 ? "" : "s"
    } finished this week, ${input.overdue} past their deadline.`,
    inputs: ["Tasks completed", "Tasks past their deadline", "Tasks still open"],
  };
}

function careerScore(input: NonNullable<PulseInputs["career"]>): Score | null {
  if (input.readiness === null && input.roadmapRatio === null) return null;

  /* Readiness carries most of the weight; the roadmap is the part the user
     can move this week. */
  const parts: number[] = [];
  if (input.readiness !== null) parts.push(input.readiness * 100 * 0.7);
  if (input.roadmapRatio !== null) parts.push(input.roadmapRatio * 100 * 0.3);

  const divisor =
    (input.readiness !== null ? 0.7 : 0) + (input.roadmapRatio !== null ? 0.3 : 0);

  const value = clamp(parts.reduce((a, b) => a + b, 0) / Math.max(divisor, 0.01));

  return {
    id: "s-career",
    label: "Career",
    domain: "career",
    value,
    band: bandFor(value),
    meaning:
      input.readiness === null
        ? "Based on your roadmap progress. Set a target role to include the skill gap."
        : `${Math.round(input.readiness * 100)}% of your target role's stated requirements are met.`,
    inputs: ["Skill gap against your target role", "Roadmap items completed"],
  };
}

function routineScore(input: NonNullable<PulseInputs["routine"]>): Score | null {
  if (input.nightsLogged === 0 && input.habitRatio === null) return null;

  const parts: number[] = [];
  let weight = 0;

  if (input.nightsLogged > 0) {
    /* Seven hours scores full marks. Not a target the product sets — it is the
       midpoint of the range adults are generally advised, and the score is
       about consistency rather than hitting a number. */
    const sleepPart = clamp((input.averageSleepMinutes / (7 * 60)) * 100);
    parts.push(sleepPart * 0.6);
    weight += 0.6;
  }

  if (input.habitRatio !== null) {
    parts.push(input.habitRatio * 100 * 0.4);
    weight += 0.4;
  }

  const value = clamp(parts.reduce((a, b) => a + b, 0) / Math.max(weight, 0.01));

  return {
    id: "s-routine",
    label: "Routine",
    domain: "routine",
    value,
    band: bandFor(value),
    meaning:
      input.nightsLogged > 0
        ? `${formatHours(input.averageSleepMinutes)} average sleep across ${
            input.nightsLogged
          } night${input.nightsLogged === 1 ? "" : "s"} recorded.`
        : "Based on the habits you kept. Record some sleep to include it.",
    inputs: ["Sleep recorded", "Habits kept against their weekly target"],
  };
}

/* -------------------------------------------------------------------------- */
/*                                  momentum                                  */
/* -------------------------------------------------------------------------- */

/**
 * Everything the product shows, in one number.
 *
 * The plain mean of the scores that exist. Deliberately unweighted: a weighting
 * would be the product deciding that the user's fitness matters more than their
 * finances, which is not ours to decide. Null below two scores, because the
 * "mean" of one number is just that number wearing a different label.
 */
export function computePulse(inputs: PulseInputs): PulseResult {
  const scores = [
    inputs.academic ? academicScore(inputs.academic) : null,
    inputs.fitness ? fitnessScore(inputs.fitness) : null,
    inputs.productivity ? productivityScore(inputs.productivity) : null,
    inputs.career ? careerScore(inputs.career) : null,
    inputs.routine ? routineScore(inputs.routine) : null,
  ].filter((score): score is Score => score !== null);

  if (scores.length < 2) {
    return { scores, momentum: null };
  }

  const value = clamp(
    scores.reduce((total, score) => total + score.value, 0) / scores.length,
  );

  return {
    scores,
    momentum: {
      id: "s-momentum",
      label: "Momentum",
      domain: "productivity",
      value,
      band: bandFor(value),
      meaning: `The average of the ${scores.length} areas your twin can currently measure. Unweighted on purpose — which part of your life matters most is not ours to decide.`,
      inputs: scores.map((score) => score.label),
    },
  };
}

/**
 * The same thing as plain integers, for one `PulseSnapshot` row.
 *
 * Zero is used here where a score is absent, because the column is not
 * nullable — and that is fine, because the snapshot's only consumer is the
 * trend, which reads a run of days. A zero day shows as a gap in the chart
 * rather than as a judgement, since `twinEvolution` plots what exists.
 */
export function pulseSnapshotRow(inputs: PulseInputs) {
  const { scores, momentum } = computePulse(inputs);
  const find = (id: string) => scores.find((score) => score.id === id)?.value ?? 0;

  return {
    academic: find("s-academic"),
    fitness: find("s-fitness"),
    productivity: find("s-productivity"),
    career: find("s-career"),
    routine: find("s-routine"),
    momentum: momentum?.value ?? 0,
  };
}

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
