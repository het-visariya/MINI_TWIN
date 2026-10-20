/**
 * Turning a user's own rows into the Home snapshot.
 *
 * Deliberately conservative. A real account starts with nothing, and the
 * honest answer to "what is my momentum?" on day one is "not enough data
 * yet" — not a number we made up to fill the card. So:
 *
 *  - scores are returned only where there is something to count
 *  - the time budget uses the user's commitments and a stated default day
 *  - the one thing is the task with the nearest deadline, and its reason
 *    states the facts that made it first
 *
 * The scoring engine proper (28-day baselines, trends, the five pulse scores)
 * belongs to phase 3 along with the modules that feed it.
 */

import type { Commitment, Score, Task, TimeBudget, TwinSnapshot } from "@/lib/domain/types";

/** Hours the day has once sleep, classes, commute and meals come out. */
const DEFAULT_RESERVED: TimeBudget["reserved"] = [
  { label: "Sleep", hours: 8 },
  { label: "Meals", hours: 1.5 },
  { label: "Commute", hours: 1 },
];

const DAY_HOURS = 24;

function reservedHours(reserved: TimeBudget["reserved"]) {
  return reserved.reduce((total, block) => total + block.hours, 0);
}

/**
 * The snapshot for an account with no data. Every number is zero and every
 * list is empty, which is what lets Home show its teaching empty state
 * instead of a screen full of plausible-looking fiction.
 */
export function emptySnapshot(greeting: string): TwinSnapshot {
  return {
    greeting,
    state: "resting",
    intensity: 0.2,
    oneThing: {
      title: "Add your first commitment",
      reason:
        "Your twin has nothing to work with yet. Add this week's classes, a workout or one task and it can start showing you what things cost.",
    },
    pulse: [],
    momentum: {
      id: "s-momentum",
      label: "Momentum",
      domain: "productivity",
      value: 0,
      band: "attention",
      meaning:
        "Momentum compares this week with your own last four weeks. It needs a few days of history before it means anything.",
      inputs: ["Tasks completed", "Habits kept", "Time planned against time used"],
    },
    timeBudget: {
      availableHours: DAY_HOURS - reservedHours(DEFAULT_RESERVED),
      plannedHours: 0,
      reserved: DEFAULT_RESERVED,
    },
    conflicts: [],
    today: [],
    brief: [],
  };
}

export function snapshotFromRows({
  greeting,
  commitments,
  tasks,
  traits,
}: {
  greeting: string;
  commitments: Commitment[];
  tasks: Task[];
  traits: Record<string, unknown>;
}): TwinSnapshot {
  const plannedHours =
    commitments.reduce((total, commitment) => total + commitment.minutes, 0) / 60;

  const reserved = reservedFromTraits(traits);
  const availableHours = Math.max(0, DAY_HOURS - reservedHours(reserved));

  const timeBudget: TimeBudget = {
    availableHours: round(availableHours),
    plannedHours: round(plannedHours),
    reserved,
  };

  const shortfall = plannedHours - availableHours;

  return {
    greeting,
    state: shortfall > 0.25 ? "stretched" : commitments.length > 0 ? "balanced" : "resting",
    /* Intensity tracks how full the day is, capped so a very heavy day does
       not make the twin frantic. */
    intensity: Math.min(0.8, 0.25 + plannedHours / 12),
    oneThing: pickOneThing(tasks, commitments),
    /* The five pulse scores need history; they arrive with phase 3's engine. */
    pulse: [],
    momentum: emptySnapshot(greeting).momentum,
    timeBudget,
    conflicts:
      shortfall > 0.25
        ? [
            {
              id: "conflict-today-time",
              summary: `Today needs ${formatHours(plannedHours)} — you have ${formatHours(
                availableHours,
              )}.`,
              domains: uniqueDomains(commitments),
              severity: shortfall > 2 ? "risk" : "attention",
              shortfallHours: round(shortfall),
              resolutions: [],
            },
          ]
        : [],
    today: commitments,
    brief: [],
  };
}

/**
 * The nearest real deadline, with the facts that put it first. Falls back to
 * the next scheduled commitment, then to the prompt to add something.
 */
function pickOneThing(tasks: Task[], commitments: Commitment[]): TwinSnapshot["oneThing"] {
  const withDue = tasks
    .filter((task) => !task.done && task.due)
    .sort((a, b) => (a.due! < b.due! ? -1 : 1));

  const next = withDue[0] ?? tasks.find((task) => !task.done);

  if (next) {
    const remaining = Math.round(
      (next.estimateMinutes * (100 - next.progress)) / 100,
    );

    return {
      title: next.title,
      reason: next.due
        ? `It is due ${formatDue(next.due)} and you estimated ${formatMinutes(
            remaining,
          )} of work left.`
        : `You estimated ${formatMinutes(remaining)} of work left and nothing else has a deadline yet.`,
      commitmentId: next.id,
    };
  }

  const upcoming = commitments.find((commitment) => commitment.start);
  if (upcoming) {
    return {
      title: upcoming.title,
      reason: `It is the next thing on your day, at ${formatTime(upcoming.start!)}.`,
      commitmentId: upcoming.id,
    };
  }

  return emptySnapshot("").oneThing;
}

/** Sleep and meal times are onboarding answers, so use them when present. */
function reservedFromTraits(traits: Record<string, unknown>): TimeBudget["reserved"] {
  const sleepHours = asNumber(traits.sleepHours);
  const commuteHours = asNumber(traits.commuteHours);

  return [
    { label: "Sleep", hours: sleepHours ?? 8 },
    { label: "Meals", hours: 1.5 },
    { label: "Commute", hours: commuteHours ?? 1 },
  ];
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function uniqueDomains(commitments: Commitment[]) {
  return [...new Set(commitments.map((commitment) => commitment.domain))];
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatHours(hours: number) {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  if (whole === 0) return `${minutes}m`;
  return minutes ? `${whole}h ${minutes}m` : `${whole}h`;
}

function formatMinutes(minutes: number) {
  return formatHours(minutes / 60);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDue(iso: string) {
  const due = new Date(iso);
  const today = new Date();
  const days = Math.round(
    (due.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86_400_000,
  );

  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** Exported for the phase-3 scoring engine to extend rather than re-derive. */
export type { Score };
