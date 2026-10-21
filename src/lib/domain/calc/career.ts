/**
 * Career calculations. Pure: no Prisma, no React, no clock.
 *
 * The readiness number here is the one place in the product where the user is
 * measured against an external standard rather than their own past, so it is
 * built to be unarguable: it is the user's own self-ratings against the
 * requirements they can edit, and every skill's contribution is visible in the
 * same object. It is never presented as a probability of being hired.
 */

export type PlacementStage =
  | "PREPARING"
  | "APPLYING"
  | "INTERVIEWING"
  | "OFFER"
  | "PLACED";

export type SkillRequirement = { skill: string; requiredLevel: number };

export type UserSkillRow = { skill: string; level: number; evidence?: string | null };

export type SkillGapRow = {
  skill: string;
  requiredLevel: number;
  /** 0 when the user has not rated this skill at all. */
  currentLevel: number;
  /** Levels still to go, never negative. */
  gap: number;
  /** True when the user is at or past the required level. */
  met: boolean;
};

export type SkillGap = {
  rows: SkillGapRow[];
  /**
   * Σ min(level, required) ÷ Σ required, as a fraction 0–1.
   *
   * The `min` is what stops one over-rated skill from papering over a missing
   * one: being a 5 where a 3 was asked for earns 3, not 5.
   */
  readiness: number | null;
  met: number;
  total: number;
};

export function skillGap(
  requirements: SkillRequirement[],
  userSkills: UserSkillRow[],
): SkillGap {
  const levels = new Map<string, number>();
  for (const skill of userSkills) {
    const key = normalise(skill.skill);
    if (!key) continue;
    /* Highest rating wins if the same skill is listed twice, which is what the
       user means by editing a duplicate rather than adding one. */
    levels.set(key, Math.max(levels.get(key) ?? 0, clampLevel(skill.level)));
  }

  const rows: SkillGapRow[] = [];
  let earned = 0;
  let required = 0;

  for (const requirement of requirements) {
    const key = normalise(requirement.skill);
    if (!key) continue;

    const requiredLevel = clampLevel(requirement.requiredLevel);
    const currentLevel = levels.get(key) ?? 0;

    earned += Math.min(currentLevel, requiredLevel);
    required += requiredLevel;

    rows.push({
      skill: requirement.skill,
      requiredLevel,
      currentLevel,
      gap: Math.max(0, requiredLevel - currentLevel),
      met: currentLevel >= requiredLevel,
    });
  }

  /* Biggest gap first: the chart is a to-do list, so it leads with the thing
     most worth doing. */
  rows.sort((a, b) => b.gap - a.gap || a.skill.localeCompare(b.skill));

  return {
    rows,
    readiness: required === 0 ? null : round(earned / required, 4),
    met: rows.filter((row) => row.met).length,
    total: rows.length,
  };
}

export type RoadmapRow = { done: boolean; dueDate?: string | null };

export type RoadmapProgress = {
  done: number;
  total: number;
  /** Fraction complete, or null when the roadmap is empty. */
  ratio: number | null;
  /** Items not done whose due date has passed. A fact, not a reprimand. */
  overdue: number;
};

export function roadmapProgress(items: RoadmapRow[], now: Date): RoadmapProgress {
  const total = items.length;
  const done = items.filter((item) => item.done).length;
  const today = startOfDay(now).getTime();

  const overdue = items.filter((item) => {
    if (item.done || !item.dueDate) return false;
    const due = new Date(item.dueDate);
    return !Number.isNaN(due.getTime()) && startOfDay(due).getTime() < today;
  }).length;

  return {
    done,
    total,
    ratio: total === 0 ? null : round(done / total, 4),
    overdue,
  };
}

/**
 * Reassign `order` so the list is 0..n-1 with no gaps.
 *
 * Called after a drag, and after a delete, because a roadmap whose orders are
 * 0, 1, 4, 7 still renders correctly but makes the next insert ambiguous.
 */
export function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return [...items];
  if (from < 0 || from >= items.length) return [...items];

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(Math.min(Math.max(to, 0), next.length), 0, moved);
  return next;
}

/** Where the user is in the placement process, as a 0–1 position. */
export const PLACEMENT_STAGES: PlacementStage[] = [
  "PREPARING",
  "APPLYING",
  "INTERVIEWING",
  "OFFER",
  "PLACED",
];

export function placementProgress(stage: PlacementStage): number {
  const index = PLACEMENT_STAGES.indexOf(stage);
  if (index < 0) return 0;
  return round(index / (PLACEMENT_STAGES.length - 1), 4);
}

/** Days until the target date. Negative once it has passed. Null without one. */
export function daysToTarget(
  targetDate: string | Date | null | undefined,
  now: Date,
): number | null {
  if (!targetDate) return null;
  const target = targetDate instanceof Date ? targetDate : new Date(targetDate);
  if (Number.isNaN(target.getTime())) return null;

  return Math.round(
    (startOfDay(target).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
}

/* -------------------------------------------------------------------------- */
/*                                   shared                                   */
/* -------------------------------------------------------------------------- */

/** Levels are 1–5. A 0 means "not rated", which is distinct from "level 1". */
function clampLevel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(5, Math.max(0, Math.round(value)));
}

function normalise(value: string): string {
  return (value ?? "").trim().toLowerCase();
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function round(value: number, places = 0): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
