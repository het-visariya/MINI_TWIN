/**
 * The Health module's data boundary.
 *
 * Two implementations with the same shape, exactly as the main repo does it:
 * `healthRepoForUser(userId)`, where every query is filtered by that id, and
 * `demoHealthRepo`, which reads fixtures and accepts writes without keeping
 * them. A screen is handed one and cannot tell which.
 *
 * All derived numbers — personal records, weekly volume, BMI, the protein and
 * water ranges — are computed by `calc/health`, never here. This file reads
 * rows and hands them to pure functions, which is what makes those functions
 * testable without a database.
 */

import { connection } from "next/server";

import { healthView } from "@/lib/data/module-fixtures";
import { getPrisma } from "@/lib/db";
import {
  ageMonths as toAgeMonths,
  ageYears as toAgeYears,
  bmi,
  bmiCategory,
  calorieEstimate,
  isoDate,
  mayShowWeightGoal,
  perMealSplit,
  personalRecords,
  proteinRange,
  startOfWeek,
  volumeSeries,
  waterForDate,
  waterTarget,
  weeklyConsistency,
  type ActivityLevel,
  type BmiVerdict,
  type PersonalRecord,
  type SetRow,
  type SexInput,
} from "@/lib/domain/calc/health";
import type {
  HealthProfileInput,
  MoodCheckinInput,
  SleepLogInput,
  WaterLogInput,
  WeightLogInput,
  WorkoutSessionInput,
} from "@/lib/validation/health";

/* -------------------------------------------------------------------------- */
/*                                   views                                    */
/* -------------------------------------------------------------------------- */

export type WorkoutSessionView = {
  id: string;
  date: string;
  notes?: string;
  sets: { id: string; exercise: string; setIndex: number; reps: number; weightKg: number }[];
  volumeKg: number;
};

export type HealthView = {
  profile: {
    heightCm: number | null;
    activityLevel: ActivityLevel;
    plannedPerWeek: number;
    /** From Profile, where the age gate wrote it. Not duplicated here. */
    sex: SexInput;
    ageYears: number | null;
    ageMonths: number | null;
    hasMedicalCondition: boolean;
    /** False under 20, with no override. */
    mayShowWeightGoal: boolean;
  };

  sessions: WorkoutSessionView[];
  /** Exercise names the user has actually used, for the autocomplete. */
  exerciseHistory: string[];
  personalRecords: PersonalRecord[];
  volume: { weekStart: string; volumeKg: number }[];
  consistency: { kept: number; planned: number; ratio: number } | null;

  weights: { date: string; weightKg: number }[];
  latestWeightKg: number | null;
  bmi: number | null;
  bmiVerdict: BmiVerdict;

  sleep: { date: string; minutes: number; quality: number | null }[];

  water: {
    todayMl: number;
    target: { minMl: number; maxMl: number; isEstimate: true; source: string } | null;
    recent: { date: string; ml: number }[];
  };

  mood: { date: string; mood: number; energy: number } | null;

  protein: {
    range: { min: number; max: number; isEstimate: true; source: string } | null;
    perMeal: { min: number; max: number; meals: number; isEstimate: true } | null;
  };
  calories: { kcal: number; isEstimate: true; source: string } | null;
};

export type HealthRepo = {
  getHealth(now?: Date): Promise<HealthView>;
  saveProfile(input: HealthProfileInput): Promise<void>;
  logWorkout(input: WorkoutSessionInput): Promise<{ id: string }>;
  deleteWorkout(sessionId: string): Promise<void>;
  logWeight(input: WeightLogInput): Promise<void>;
  logSleep(input: SleepLogInput): Promise<void>;
  logWater(input: WaterLogInput): Promise<void>;
  saveMood(input: MoodCheckinInput): Promise<void>;
  /**
   * The weight goal, for adults only.
   *
   * Takes the already-validated target: the age rule is enforced by
   * `weightGoalSchema` in the action, using the age read from Profile on the
   * server. This function stores what it is given.
   */
  saveWeightGoal(targetKg: number, byDate: Date | null): Promise<void>;
};

/** How far back the module reads. Enough for an eight-week volume chart. */
const WINDOW_DAYS = 120;

/* -------------------------------------------------------------------------- */
/*                                  per user                                  */
/* -------------------------------------------------------------------------- */

export function healthRepoForUser(userId: string): HealthRepo {
  const prisma = getPrisma();

  return {
    async getHealth(now = new Date()) {
      await connection();

      const since = new Date(now);
      since.setDate(since.getDate() - WINDOW_DAYS);

      const [profile, healthProfile, sessions, weights, sleep, water, mood] =
        await Promise.all([
          prisma.profile.findUnique({ where: { userId } }),
          prisma.healthProfile.findUnique({ where: { userId } }),
          prisma.workoutSession.findMany({
            where: { userId, date: { gte: since } },
            orderBy: { date: "desc" },
            include: { sets: { orderBy: { setIndex: "asc" } } },
          }),
          prisma.weightLog.findMany({
            where: { userId, date: { gte: since } },
            orderBy: { date: "asc" },
          }),
          prisma.sleepLog.findMany({
            where: { userId, date: { gte: since } },
            orderBy: { date: "asc" },
          }),
          prisma.waterLog.findMany({
            where: { userId, date: { gte: since } },
            orderBy: { date: "desc" },
          }),
          prisma.moodCheckin.findFirst({
            where: { userId, date: startOfToday(now) },
          }),
        ]);

      const sessionViews: WorkoutSessionView[] = sessions.map((session) => ({
        id: session.id,
        date: isoDate(session.date),
        notes: session.notes ?? undefined,
        sets: session.sets.map((set) => ({
          id: set.id,
          exercise: set.exercise,
          setIndex: set.setIndex,
          reps: set.reps,
          weightKg: set.weightKg,
        })),
        volumeKg: session.sets.reduce(
          (total, set) => total + set.reps * set.weightKg,
          0,
        ),
      }));

      const setRows: SetRow[] = sessions.flatMap((session) =>
        session.sets.map((set) => ({
          exercise: set.exercise,
          reps: set.reps,
          weightKg: set.weightKg,
          date: isoDate(session.date),
        })),
      );

      const activityLevel = (healthProfile?.activityLevel ?? "LIGHT") as ActivityLevel;
      const plannedPerWeek = healthProfile?.plannedPerWeek ?? 3;
      const heightCm = healthProfile?.heightCm ?? null;

      const sex = (profile?.sex ?? null) as SexInput;
      const years = toAgeYears(profile?.dob ?? null, now);
      const months = toAgeMonths(profile?.dob ?? null, now);

      const latestWeightKg = weights.length > 0 ? weights[weights.length - 1].weightKg : null;
      const bmiValue = bmi(heightCm, latestWeightKg);

      const range = proteinRange(latestWeightKg, activityLevel);
      const mealsPerDay = asNumber((profile?.traits as Record<string, unknown>)?.mealsPerDay) ?? 3;

      return {
        profile: {
          heightCm,
          activityLevel,
          plannedPerWeek,
          sex,
          ageYears: years,
          ageMonths: months,
          hasMedicalCondition: profile?.hasMedicalCondition ?? false,
          mayShowWeightGoal: mayShowWeightGoal(years),
        },

        sessions: sessionViews,
        exerciseHistory: [
          ...new Set(setRows.map((set) => set.exercise).filter(Boolean)),
        ].sort((a, b) => a.localeCompare(b)),
        personalRecords: personalRecords(setRows),
        volume: volumeSeries(setRows, now, 8),
        consistency: weeklyConsistency(
          sessionViews.map((session) => ({ date: session.date })),
          plannedPerWeek,
          startOfWeek(now),
        ),

        weights: weights.map((row) => ({
          date: isoDate(row.date),
          weightKg: row.weightKg,
        })),
        latestWeightKg,
        bmi: bmiValue,
        bmiVerdict: bmiCategory(bmiValue, { ageMonths: months, sex }),

        sleep: sleep.map((row) => ({
          date: isoDate(row.date),
          minutes: row.minutes,
          quality: row.quality,
        })),

        water: {
          todayMl: waterForDate(
            water.map((row) => ({ date: isoDate(row.date), ml: row.ml })),
            now,
          ),
          target: waterTarget(latestWeightKg),
          recent: water
            .slice(0, 20)
            .map((row) => ({ date: isoDate(row.date), ml: row.ml })),
        },

        mood: mood
          ? { date: isoDate(mood.date), mood: mood.mood, energy: mood.energy }
          : null,

        protein: { range, perMeal: perMealSplit(range, mealsPerDay) },
        calories: calorieEstimate({
          weightKg: latestWeightKg,
          heightCm,
          ageYears: years,
          sex,
          activityLevel,
        }),
      };
    },

    async saveProfile(input) {
      await prisma.healthProfile.upsert({
        where: { userId },
        create: {
          userId,
          heightCm: input.heightCm ?? null,
          activityLevel: input.activityLevel,
          plannedPerWeek: input.plannedPerWeek,
        },
        update: {
          heightCm: input.heightCm ?? null,
          activityLevel: input.activityLevel,
          plannedPerWeek: input.plannedPerWeek,
        },
      });
    },

    /**
     * A session and its sets in one transaction. A half-written workout — the
     * session row saved, the sets lost — would show as an empty session the
     * user cannot explain, so it is all or nothing.
     */
    async logWorkout(input) {
      const session = await prisma.workoutSession.create({
        data: {
          userId,
          date: input.date,
          notes: input.notes ?? null,
          sets: {
            create: input.sets.map((set, index) => ({
              userId,
              exercise: set.exercise,
              setIndex: index,
              reps: set.reps,
              weightKg: set.weightKg,
            })),
          },
        },
        select: { id: true },
      });

      return session;
    },

    async deleteWorkout(sessionId) {
      /* The userId in the filter is what makes this safe: another user's id
         matches nothing and deletes nothing, rather than throwing a 403 that
         confirms the row exists. */
      await prisma.workoutSession.deleteMany({ where: { id: sessionId, userId } });
    },

    async logWeight(input) {
      await prisma.weightLog.upsert({
        where: { userId_date: { userId, date: input.date } },
        create: { userId, date: input.date, weightKg: input.weightKg },
        update: { weightKg: input.weightKg },
      });
    },

    async logSleep(input) {
      await prisma.sleepLog.upsert({
        where: { userId_date: { userId, date: input.date } },
        create: {
          userId,
          date: input.date,
          minutes: input.minutes,
          quality: input.quality ?? null,
        },
        update: { minutes: input.minutes, quality: input.quality ?? null },
      });
    },

    /** Appended, not upserted: water is logged in several entries a day. */
    async logWater(input) {
      await prisma.waterLog.create({
        data: { userId, date: input.date, ml: input.ml },
      });
    },

    /**
     * Stored in `Profile.traits`, because a goal is a stated preference rather
     * than a measurement — the same place onboarding's answers live.
     */
    async saveWeightGoal(targetKg, byDate) {
      const profile = await prisma.profile.findUnique({
        where: { userId },
        select: { traits: true },
      });

      const traits = (profile?.traits ?? {}) as Record<string, unknown>;

      await prisma.profile.update({
        where: { userId },
        data: {
          traits: {
            ...traits,
            weightGoalKg: targetKg,
            weightGoalBy: byDate ? byDate.toISOString() : null,
          },
        },
      });
    },

    /** One check-in per day. A second one edits the first rather than stacking. */
    async saveMood(input) {
      await prisma.moodCheckin.upsert({
        where: { userId_date: { userId, date: input.date } },
        create: {
          userId,
          date: input.date,
          mood: input.mood,
          energy: input.energy,
        },
        update: { mood: input.mood, energy: input.energy },
      });
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                    demo                                    */
/* -------------------------------------------------------------------------- */

export const demoHealthRepo: HealthRepo = {
  async getHealth(now = new Date()) {
    await connection();
    return healthView(now);
  },

  /* Every write is accepted and discarded. The screen has already updated
     optimistically, so the demo feels like the product; nothing reaches a
     database, so it cannot affect a real account or another visitor. */
  async saveProfile() {},
  async logWorkout() {
    return { id: "demo-session" };
  },
  async deleteWorkout() {},
  async logWeight() {},
  async logSleep() {},
  async logWater() {},
  async saveMood() {},
  async saveWeightGoal() {},
};

/* -------------------------------------------------------------------------- */
/*                                   shared                                   */
/* -------------------------------------------------------------------------- */

function startOfToday(now: Date): Date {
  const copy = new Date(now);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
