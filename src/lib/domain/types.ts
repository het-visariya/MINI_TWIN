import type { Domain, Status } from "@/lib/design/tokens";

export type { Domain, Status };

/** ISO-8601 date-time string. */
export type Timestamp = string;

/* ---------------------------------------------------------------------------
   The commitment backbone.

   Classes, assignments, workouts, study sessions, meetings and personal blocks
   are all Commitments. One scheduling model is what lets the twin reason about
   time across domains instead of becoming sixteen separate apps.
   --------------------------------------------------------------------------- */

/** How freely a commitment can be moved when the day has to be rebuilt. */
export type Flexibility = "fixed" | "shiftable" | "flexible";

export type Priority = "critical" | "high" | "normal" | "low";

export type Commitment = {
  id: string;
  title: string;
  domain: Domain;
  /** Planned minutes. Estimates are the user's own unless marked otherwise. */
  minutes: number;
  start?: Timestamp;
  flexibility: Flexibility;
  priority: Priority;
  /** Commitment ids that must happen before this one. */
  dependsOn?: string[];
  /** Why this exists — shown to the user, never inferred silently. */
  source?: string;
};

/* --------------------------------- scores -------------------------------- */

/**
 * Every score the product shows carries its own explanation and inputs.
 * A score without `meaning` must not render — see ScoreCard.
 */
export type Score = {
  id: string;
  label: string;
  domain: Domain;
  /** 0–100. */
  value: number;
  band: Status;
  /** Plain-language statement of what this number means for the user. */
  meaning: string;
  /** The factors it was computed from, named for the user. */
  inputs: string[];
  /** Change against the user's own recent past, in points. */
  trend?: number;
};

/* ------------------------------ consequences ----------------------------- */

/** One effect of choosing an option, in one domain. */
export type Effect = {
  domain: Domain;
  /** e.g. "Tomorrow becomes 2h heavier". */
  statement: string;
  direction: "better" | "worse" | "neutral";
};

export type ConsequenceOption = {
  id: string;
  label: string;
  /** What this option asks of the user right now. */
  cost: string;
  effects: Effect[];
  recommended?: boolean;
};

/**
 * A decision the user is about to make, with both sides stated.
 * Regret Preview, "Fix my day" and plan negotiation all render this shape.
 */
export type Consequence = {
  id: string;
  question: string;
  options: ConsequenceOption[];
  /** Assumptions behind the figures. Always shown — never implied certainty. */
  assumptions: string[];
};

/* -------------------------------- planning ------------------------------- */

export type TimeBudget = {
  /** Hours left in the day after sleep, classes, commute and meals. */
  availableHours: number;
  /** Hours the current plan needs. */
  plannedHours: number;
  /** The blocks subtracted from the day, for transparency. */
  reserved: { label: string; hours: number }[];
};

export type Conflict = {
  id: string;
  /** What collides, in the user's words. */
  summary: string;
  domains: Domain[];
  severity: Status;
  shortfallHours?: number;
  /** Ways out the twin can offer — the user chooses. */
  resolutions: { id: string; label: string; detail: string }[];
};

/* --------------------------------- tasks --------------------------------- */

export type Task = {
  id: string;
  title: string;
  domain: Domain;
  due?: Timestamp;
  estimateMinutes: number;
  progress: number;
  priority: Priority;
  /** The ranking explanation. A ranked task always answers "Why?". */
  why: string;
  done?: boolean;
};

/* ------------------------------- simulation ------------------------------ */

/**
 * Projected, not measured. Anything carrying this must render inside
 * <SimulationFrame> so it is visibly labelled as a simulation.
 */
export type Simulation<T> = {
  kind: "simulation";
  assumptions: string[];
  horizon: "today" | "3-day" | "7-day" | "30-day";
  data: T;
};

export type ScenarioPath = {
  id: string;
  label: string;
  /** Projected score per domain at the end of the horizon. */
  outcomes: { domain: Domain; label: string; value: number }[];
  summary: string;
};

/* ---------------------------------- twin --------------------------------- */

/**
 * The twin's visual state. Driven by explicit app state and user preference
 * only — never by inferred mood, and never expressing disappointment.
 */
export type TwinState = "focused" | "balanced" | "stretched" | "resting";

export type TwinSnapshot = {
  greeting: string;
  state: TwinState;
  /** 0–1, how energetic the visual is allowed to be. */
  intensity: number;
  /** The single most important action right now, with its reason. */
  oneThing: { title: string; reason: string; commitmentId?: string };
  pulse: Score[];
  momentum: Score;
  timeBudget: TimeBudget;
  conflicts: Conflict[];
  today: Commitment[];
  brief: string[];
};

/* ------------------------------ conversation ----------------------------- */

export type DataUse = {
  /** Field group the twin wants to read, in plain language. */
  label: string;
  detail: string;
};

export type PlanProposal = {
  id: string;
  summary: string;
  changes: { label: string; detail: string }[];
  /** The user accepts, edits or declines. Nothing is applied without that. */
  status: "proposed" | "accepted" | "declined";
};

export type TwinMessage = {
  id: string;
  author: "user" | "twin";
  text: string;
  /** Which of the user's own numbers the answer used. */
  sources?: { label: string; value: string }[];
  proposal?: PlanProposal;
  /** Follow-ups offered as chips. */
  suggestions?: string[];
  /** Shown when the message required sending personal context. */
  consent?: DataUse[];
};

/* -------------------------------- regreter ------------------------------- */

export type RegreterTone = "gentle" | "balanced" | "direct" | "no-mercy";

export type CostReceipt = {
  id: string;
  missed: string;
  /** What it actually cost, drawn from the planning engine. */
  effects: Effect[];
  /** One-tap recovery offer. */
  recovery: { label: string; detail: string };
};

/* ------------------------- goals, subjects, habits ------------------------ */

/**
 * Added in phase 2, when these stopped being fixture literals and became
 * database rows. The fixtures and the Prisma mappers both conform to these,
 * so a screen cannot tell which one it is rendering.
 */

export type Goal = {
  id: string;
  title: string;
  domain: Domain;
  /** 0–100. */
  progress: number;
  due?: Timestamp;
  /** Hours a week this goal asks for. Feeds the goal conflict detector. */
  needsHoursPerWeek: number;
  notes?: string;
};

export type SubjectDifficulty = "low" | "medium" | "high";

export type Subject = {
  id: string;
  name: string;
  code?: string;
  credits: number;
  difficulty: SubjectDifficulty;
  /** Attendance is the input to the bunk budget, so it is never optional. */
  attendance: { attended: number; held: number; required: number };
  /** Absent until the user records marks. Never estimated on their behalf. */
  grade?: { expected: string; internal: number; internalMax: number };
};

export type Habit = {
  id: string;
  label: string;
  /** Days completed out of the last 28 — compared only with the user's past. */
  days28: number;
  domain: Domain;
};

export type HeatmapRow = { domain: Domain; label: string; values: number[] };

export type Heatmap = { days: string[]; rows: HeatmapRow[] };
