/**
 * Health calculations. Pure: no Prisma, no React, and no clock — anything that
 * depends on "now" takes it as an argument, so every function here is
 * reproducible and testable.
 *
 * Two rules shape this file:
 *
 *  1. Nothing returns a number that pretends to be a measurement. An estimate
 *     carries `isEstimate` or says "estimate" in its own label, and a value we
 *     cannot responsibly compute returns `null` with a stated reason rather
 *     than a plausible guess.
 *  2. The age-dependent safety rules live here, not in the UI. A screen that
 *     forgets to hide a control is a bug; a calculation that refuses to return
 *     a weight-loss target under 20 is a guarantee.
 */

import cdcBmiForAge from "@/lib/domain/data/cdc-bmi-for-age.json";

export type ActivityLevel =
  | "SEDENTARY"
  | "LIGHT"
  | "MODERATE"
  | "ACTIVE"
  | "VERY_ACTIVE";

export type SexInput = "FEMALE" | "MALE" | "PREFER_NOT_TO_SAY" | null | undefined;

/* -------------------------------------------------------------------------- */
/*                              workouts and sets                             */
/* -------------------------------------------------------------------------- */

export type SetRow = {
  exercise: string;
  reps: number;
  weightKg: number;
  /** ISO date (yyyy-mm-dd) or anything Date can parse. */
  date: string;
};

export type SessionRow = { date: string };

export type PersonalRecord = {
  exercise: string;
  /** Heaviest single set actually lifted. A measurement, not an estimate. */
  bestWeightKg: number;
  bestWeightReps: number;
  /**
   * Epley one-rep-max. An estimate by construction: the formula is a curve fit
   * to population data, not this user's true maximum.
   */
  estimatedOneRepMaxKg: number;
  isEstimate: true;
};

/**
 * Epley: 1RM ≈ w × (1 + reps / 30).
 *
 * Returns the weight itself for a single rep, where there is nothing to
 * extrapolate, and 0 for a bodyweight set — multiplying zero load by a rep
 * factor would still be zero, but saying so explicitly documents the intent.
 */
export function epleyOneRepMax(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return 0;
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return round(weightKg, 1);
  return round(weightKg * (1 + reps / 30), 1);
}

/**
 * Best weight and best estimated 1RM per exercise.
 *
 * The two can disagree — 100 kg × 1 is a heavier lift than 80 kg × 8 but a
 * lower estimated maximum — so both are reported rather than collapsing them
 * into one "best".
 */
export function personalRecords(sets: SetRow[]): PersonalRecord[] {
  const byExercise = new Map<string, PersonalRecord>();

  for (const set of sets) {
    const exercise = normaliseExercise(set.exercise);
    if (!exercise) continue;
    if (!Number.isFinite(set.reps) || set.reps <= 0) continue;
    if (!Number.isFinite(set.weightKg) || set.weightKg < 0) continue;

    const oneRepMax = epleyOneRepMax(set.weightKg, set.reps);
    const current = byExercise.get(exercise);

    if (!current) {
      byExercise.set(exercise, {
        exercise,
        bestWeightKg: set.weightKg,
        bestWeightReps: set.reps,
        estimatedOneRepMaxKg: oneRepMax,
        isEstimate: true,
      });
      continue;
    }

    if (set.weightKg > current.bestWeightKg) {
      current.bestWeightKg = set.weightKg;
      current.bestWeightReps = set.reps;
    }
    if (oneRepMax > current.estimatedOneRepMaxKg) {
      current.estimatedOneRepMaxKg = oneRepMax;
    }
  }

  return [...byExercise.values()].sort((a, b) => a.exercise.localeCompare(b.exercise));
}

/**
 * True when `set` beats everything in `history` for its exercise, which is
 * what puts the PR badge on a row the moment it is logged.
 */
export function isPersonalRecord(set: SetRow, history: SetRow[]): boolean {
  const exercise = normaliseExercise(set.exercise);
  const previous = personalRecords(
    history.filter((row) => normaliseExercise(row.exercise) === exercise),
  )[0];

  if (!previous) return set.weightKg > 0;
  return (
    set.weightKg > previous.bestWeightKg ||
    epleyOneRepMax(set.weightKg, set.reps) > previous.estimatedOneRepMaxKg
  );
}

/** Σ reps × weight for the seven days starting at `weekStart`. */
export function weeklyVolume(sets: SetRow[], weekStart: Date): number {
  const start = startOfDay(weekStart).getTime();
  const end = start + 7 * 86_400_000;

  let total = 0;
  for (const set of sets) {
    const at = startOfDay(new Date(set.date)).getTime();
    if (Number.isNaN(at) || at < start || at >= end) continue;
    if (set.reps <= 0 || set.weightKg <= 0) continue;
    total += set.reps * set.weightKg;
  }

  return round(total, 1);
}

/** Volume per week for the `weeks` weeks ending with the one holding `now`. */
export function volumeSeries(
  sets: SetRow[],
  now: Date,
  weeks = 8,
): { weekStart: string; volumeKg: number }[] {
  const thisWeek = startOfWeek(now);
  const series: { weekStart: string; volumeKg: number }[] = [];

  for (let index = weeks - 1; index >= 0; index -= 1) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - index * 7);
    series.push({
      weekStart: isoDate(start),
      volumeKg: weeklyVolume(sets, start),
    });
  }

  return series;
}

/**
 * Sessions kept against sessions planned, capped at 1.
 *
 * Compared only with the user's own stated plan — never with other people, and
 * never with a default the product chose for them. A plan of zero returns
 * `null`: there is nothing to be consistent with.
 */
export function weeklyConsistency(
  sessions: SessionRow[],
  plannedPerWeek: number,
  weekStart: Date,
): { kept: number; planned: number; ratio: number } | null {
  if (!Number.isFinite(plannedPerWeek) || plannedPerWeek <= 0) return null;

  const start = startOfDay(weekStart).getTime();
  const end = start + 7 * 86_400_000;

  const kept = sessions.filter((session) => {
    const at = startOfDay(new Date(session.date)).getTime();
    return !Number.isNaN(at) && at >= start && at < end;
  }).length;

  return {
    kept,
    planned: plannedPerWeek,
    ratio: Math.min(1, round(kept / plannedPerWeek, 3)),
  };
}

function normaliseExercise(value: string): string {
  return (value ?? "").trim().toLowerCase();
}

/* -------------------------------------------------------------------------- */
/*                                     BMI                                    */
/* -------------------------------------------------------------------------- */

export type BmiBand = "underweight" | "healthy" | "overweight" | "obese";

export type BmiVerdict =
  /** Adult categories. Only ever returned at 20 years and over. */
  | { kind: "adult"; category: BmiBand; label: string }
  /** BMI-for-age, from the CDC 2000 reference. Used under 20. */
  | { kind: "for-age"; category: BmiBand; percentile: number; label: string }
  /** We will not guess. `reason` is shown to the user as-is. */
  | { kind: "unavailable"; category: null; reason: string };

/** Weight in kg over height in metres squared. Null for impossible inputs. */
export function bmi(heightCm: number | null | undefined, weightKg: number | null | undefined) {
  if (!Number.isFinite(heightCm as number) || !Number.isFinite(weightKg as number)) {
    return null;
  }
  if ((heightCm as number) <= 0 || (weightKg as number) <= 0) return null;

  const metres = (heightCm as number) / 100;
  return round((weightKg as number) / (metres * metres), 1);
}

/**
 * Which band a BMI falls in — and, under 20, whether we can say at all.
 *
 * At 20 and over this is the familiar adult table. Under 20 a BMI number means
 * nothing on its own: the same 19 is high for a seven-year-old and low for a
 * nineteen-year-old, so the CDC BMI-for-age percentile is used instead, which
 * needs both age in months and sex. Without those, this returns `unavailable`
 * rather than quietly applying the adult table to a child.
 */
export function bmiCategory(
  bmiValue: number | null,
  context: { ageMonths: number | null; sex?: SexInput },
): BmiVerdict {
  if (bmiValue === null || !Number.isFinite(bmiValue) || bmiValue <= 0) {
    return {
      kind: "unavailable",
      category: null,
      reason: "Add your height and a weight entry to see this.",
    };
  }

  const { ageMonths, sex } = context;

  if (ageMonths === null || !Number.isFinite(ageMonths)) {
    return {
      kind: "unavailable",
      category: null,
      reason: "needs your date of birth",
    };
  }

  if (ageMonths >= ADULT_FROM_MONTHS) {
    const category = adultBand(bmiValue);
    return { kind: "adult", category, label: ADULT_LABELS[category] };
  }

  const percentile = bmiForAgePercentile(bmiValue, ageMonths, sex);

  if (percentile === null) {
    return {
      kind: "unavailable",
      category: null,
      reason: "needs age-and-sex reference data",
    };
  }

  const category = forAgeBand(percentile);
  return {
    kind: "for-age",
    category,
    percentile: round(percentile, 1),
    label: `${ordinal(Math.round(percentile))} percentile for your age`,
  };
}

/** 20 years. Below this the adult table does not apply. */
const ADULT_FROM_MONTHS = 240;

/**
 * WHO/CDC adult cut-offs. Kept in one place so the thresholds are reviewable
 * rather than scattered through comparisons.
 * Source: WHO, Body mass index classification for adults.
 */
const ADULT_CUTOFFS = { underweight: 18.5, healthy: 25, overweight: 30 } as const;

const ADULT_LABELS: Record<BmiBand, string> = {
  underweight: "Below the healthy range",
  healthy: "In the healthy range",
  overweight: "Above the healthy range",
  obese: "Well above the healthy range",
};

function adultBand(value: number): BmiBand {
  if (value < ADULT_CUTOFFS.underweight) return "underweight";
  if (value < ADULT_CUTOFFS.healthy) return "healthy";
  if (value < ADULT_CUTOFFS.overweight) return "overweight";
  return "obese";
}

/**
 * CDC BMI-for-age bands: under the 5th percentile, 5th to under 85th, 85th to
 * under 95th, and 95th or above.
 */
function forAgeBand(percentile: number): BmiBand {
  if (percentile < 5) return "underweight";
  if (percentile < 85) return "healthy";
  if (percentile < 95) return "overweight";
  return "obese";
}

type LmsRow = readonly [sex: number, agemos: number, L: number, M: number, S: number];

const LMS_ROWS = cdcBmiForAge.rows as unknown as LmsRow[];

/**
 * BMI-for-age percentile from the CDC 2000 LMS parameters.
 *
 * z = ((BMI / M)^L − 1) / (L × S), or ln(BMI / M) / S when L is zero, then the
 * normal CDF. L, M and S are interpolated linearly between the two bracketing
 * half-month rows, which is what the CDC's own documentation prescribes.
 *
 * Returns null — rather than a number — when sex is unknown or the age falls
 * outside the table's 24 to 240.5 month range. The reference is published per
 * sex; there is no sex-neutral curve to fall back on, and inventing one would
 * put a made-up percentile in front of a teenager.
 */
export function bmiForAgePercentile(
  bmiValue: number,
  ageMonths: number,
  sex?: SexInput,
): number | null {
  const sexCode = sex === "MALE" ? 1 : sex === "FEMALE" ? 2 : null;
  if (sexCode === null) return null;

  const rows = LMS_ROWS.filter((row) => row[0] === sexCode);
  if (rows.length === 0) return null;

  const first = rows[0];
  const last = rows[rows.length - 1];
  if (ageMonths < first[1] || ageMonths > last[1]) return null;

  let lower = first;
  let upper = last;
  for (let index = 0; index < rows.length - 1; index += 1) {
    if (rows[index][1] <= ageMonths && ageMonths <= rows[index + 1][1]) {
      lower = rows[index];
      upper = rows[index + 1];
      break;
    }
  }

  const span = upper[1] - lower[1];
  const t = span === 0 ? 0 : (ageMonths - lower[1]) / span;

  const L = lower[2] + (upper[2] - lower[2]) * t;
  const M = lower[3] + (upper[3] - lower[3]) * t;
  const S = lower[4] + (upper[4] - lower[4]) * t;

  if (M <= 0 || S <= 0) return null;

  const z =
    Math.abs(L) < 1e-10
      ? Math.log(bmiValue / M) / S
      : (Math.pow(bmiValue / M, L) - 1) / (L * S);

  if (!Number.isFinite(z)) return null;

  /* Clamped away from exactly 0 and 100: a percentile of 0 reads as "no data"
     rather than "at the very bottom of the reference". */
  return Math.min(99.9, Math.max(0.1, normalCdf(z) * 100));
}

/**
 * Standard normal CDF via the Abramowitz & Stegun 7.1.26 error-function
 * approximation. Maximum absolute error 1.5e-7, which is far finer than a
 * percentile displayed to one decimal place.
 */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;

  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);

  return 0.5 * (1 + sign * erf);
}

/* -------------------------------------------------------------------------- */
/*                          protein, water, calories                         */
/* -------------------------------------------------------------------------- */

/**
 * Grams of protein per kg of bodyweight, by activity level.
 *
 * Sources: the adult RDA is 0.8 g/kg (Institute of Medicine, Dietary Reference
 * Intakes, 2005). The higher ranges are the ACSM/ISSN position-stand bands for
 * people training regularly (1.2–2.0 g/kg). These are population ranges, so
 * every value derived from them is reported as a range and labelled an
 * estimate — never as "your" protein target.
 */
export const PROTEIN_G_PER_KG: Record<ActivityLevel, { min: number; max: number }> = {
  SEDENTARY: { min: 0.8, max: 1.0 },
  LIGHT: { min: 1.0, max: 1.2 },
  MODERATE: { min: 1.2, max: 1.4 },
  ACTIVE: { min: 1.4, max: 1.6 },
  VERY_ACTIVE: { min: 1.6, max: 2.0 },
};

export type Range = { min: number; max: number; isEstimate: true; source: string };

export function proteinRange(
  weightKg: number | null | undefined,
  activityLevel: ActivityLevel,
): Range | null {
  if (!Number.isFinite(weightKg as number) || (weightKg as number) <= 0) return null;

  const band = PROTEIN_G_PER_KG[activityLevel] ?? PROTEIN_G_PER_KG.LIGHT;

  return {
    min: Math.round((weightKg as number) * band.min),
    max: Math.round((weightKg as number) * band.max),
    isEstimate: true,
    source: "IOM 2005 RDA and ACSM/ISSN position stands",
  };
}

/** The same range divided across the day's meals, rounded to whole grams. */
export function perMealSplit(range: Range | null, meals: number) {
  if (!range) return null;
  if (!Number.isFinite(meals) || meals < 1) return null;

  return {
    min: Math.round(range.min / meals),
    max: Math.round(range.max / meals),
    meals: Math.round(meals),
    isEstimate: true as const,
  };
}

/**
 * Water, 30–35 ml per kg per day.
 *
 * A general population estimate (EFSA 2010 adequate intakes land in the same
 * place for typical bodyweights), not a prescription: it ignores climate,
 * illness and training load, all of which matter more than bodyweight does.
 */
export const WATER_ML_PER_KG = { min: 30, max: 35 } as const;

export function waterTarget(weightKg: number | null | undefined) {
  if (!Number.isFinite(weightKg as number) || (weightKg as number) <= 0) return null;

  return {
    minMl: Math.round(((weightKg as number) * WATER_ML_PER_KG.min) / 50) * 50,
    maxMl: Math.round(((weightKg as number) * WATER_ML_PER_KG.max) / 50) * 50,
    isEstimate: true as const,
    source: "≈30–35 ml/kg, a general adult estimate",
  };
}

/**
 * Multipliers applied to resting energy expenditure.
 * Source: the Harris–Benedict activity factors, as used with Mifflin–St Jeor.
 */
const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

/**
 * Daily energy estimate, Mifflin–St Jeor × activity factor.
 *
 * Returns null under 18. The equation is validated on adults, and putting a
 * calorie number in front of a minor is the first step of the thing this
 * product refuses to do. Also returns null without a sex, which the equation
 * needs and which the user is never required to give.
 */
export function calorieEstimate(input: {
  weightKg: number | null | undefined;
  heightCm: number | null | undefined;
  ageYears: number | null | undefined;
  sex: SexInput;
  activityLevel: ActivityLevel;
}): { kcal: number; isEstimate: true; source: string } | null {
  const { weightKg, heightCm, ageYears, sex, activityLevel } = input;

  if (!Number.isFinite(ageYears as number) || (ageYears as number) < 18) return null;
  if (sex !== "MALE" && sex !== "FEMALE") return null;
  if (!Number.isFinite(weightKg as number) || (weightKg as number) <= 0) return null;
  if (!Number.isFinite(heightCm as number) || (heightCm as number) <= 0) return null;

  const base =
    10 * (weightKg as number) +
    6.25 * (heightCm as number) -
    5 * (ageYears as number) +
    (sex === "MALE" ? 5 : -161);

  const factor = ACTIVITY_FACTOR[activityLevel] ?? ACTIVITY_FACTOR.LIGHT;

  return {
    kcal: Math.round((base * factor) / 10) * 10,
    isEstimate: true,
    source: "Mifflin–St Jeor with a standard activity factor",
  };
}

/* -------------------------------------------------------------------------- */
/*                                   safety                                   */
/* -------------------------------------------------------------------------- */

/**
 * Whether weight-goal controls may be offered at all.
 *
 * Under 20 the answer is no, with no override. This is checked here, by the
 * server action and by the form, because defence in one layer is not defence:
 * a screen can be re-rendered, but a rejected mutation cannot be talked round.
 */
export function mayShowWeightGoal(ageYears: number | null | undefined): boolean {
  return Number.isFinite(ageYears as number) && (ageYears as number) >= 20;
}

/** Whole years between `dob` and `now`. Null when there is no date of birth. */
export function ageYears(dob: Date | string | null | undefined, now: Date): number | null {
  const months = ageMonths(dob, now);
  return months === null ? null : Math.floor(months / 12);
}

/** Age in months, which BMI-for-age needs. Fractional, as the CDC table is. */
export function ageMonths(
  dob: Date | string | null | undefined,
  now: Date,
): number | null {
  if (!dob) return null;
  const born = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(born.getTime())) return null;

  const months =
    (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());

  /* Part-months matter: the table is indexed every half month, and rounding a
     19-year-old up to 20 would hand them the adult table a month early. */
  const dayFraction = (now.getDate() - born.getDate()) / 30.4375;
  const value = months + dayFraction;

  return value < 0 ? null : round(value, 1);
}

/* -------------------------------------------------------------------------- */
/*                              sleep and water                               */
/* -------------------------------------------------------------------------- */

/** Minutes between bedtime and wake time, handling a night that crosses midnight. */
export function sleepMinutes(bedtimeMinutes: number, wakeMinutes: number): number {
  const span = wakeMinutes - bedtimeMinutes;
  return span >= 0 ? span : span + 24 * 60;
}

/** Total ml logged on one date. Water is logged in several small entries. */
export function waterForDate(logs: { date: string; ml: number }[], date: Date): number {
  const target = isoDate(date);
  return logs
    .filter((log) => isoDate(new Date(log.date)) === target)
    .reduce((total, log) => total + (Number.isFinite(log.ml) ? log.ml : 0), 0);
}

/* -------------------------------------------------------------------------- */
/*                                   shared                                   */
/* -------------------------------------------------------------------------- */

export function round(value: number, places = 0): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Weeks start on Monday, which is how a student's timetable is written. */
export function startOfWeek(date: Date): Date {
  const copy = startOfDay(date);
  const weekday = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - weekday);
  return copy;
}

/**
 * Format a *moment in time* as the calendar date it falls on locally.
 *
 * Use for timestamps — `new Date()`, a `createdAt`, anything computed from
 * "now". For a value read out of a `@db.Date` column use `isoCalendarDate`
 * instead: those come back as UTC midnight, and reading them with local
 * getters shifts the day for anyone not on UTC.
 */
export function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The UTC midnight that identifies the calendar day `date` falls on locally.
 *
 * For building a value to *match* a `@db.Date` column. Those are stored at UTC
 * midnight, so an equality filter built from local midnight matches nothing at
 * all east of Greenwich — today's mood check-in or meal log simply disappears.
 * The local getters are deliberate: the day is the user's day, and only the
 * representation is UTC.
 */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Format a value read from a `@db.Date` column.
 *
 * Prisma hands those back as UTC midnight, so the calendar date is carried by
 * the UTC components and only those. The counterpart of `toCalendarDate`,
 * which writes them the same way; the pair is what keeps a date the user
 * picked identical to the date they are later shown.
 */
export function isoCalendarDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}
