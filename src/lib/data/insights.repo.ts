/**
 * The Insights module's data boundary, plus the daily snapshot job.
 *
 * `gatherPulseInputs` is the single place that reads the rows the five scores
 * are made of. Home calls it to render the pulse live; the snapshot job calls
 * it to store today's values so a trend exists next month. One reader, one
 * arithmetic implementation (`calc/pulse`), so the number on Home and the
 * number in the sparkline cannot drift apart.
 */

import { connection } from "next/server";

import { insightsView } from "@/lib/data/module-fixtures";
import { getPrisma } from "@/lib/db";
import { isoDate, startOfWeek } from "@/lib/domain/calc/health";
import { roadmapProgress, skillGap } from "@/lib/domain/calc/career";
import {
  computePulse,
  pulseSnapshotRow,
  type PulseInputs,
  type PulseResult,
} from "@/lib/domain/calc/pulse";
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  lifeGraph,
  twinEvolution,
  weeklyReview,
  type AchievementDefinition,
  type AchievementKey,
  type DaySeries,
  type EvolutionSeries,
  type LifeGraph,
  type SnapshotRow,
  type WeeklyReviewResult,
} from "@/lib/domain/calc/insights";

/* -------------------------------------------------------------------------- */
/*                                   views                                    */
/* -------------------------------------------------------------------------- */

export type InsightsView = {
  evolution: EvolutionSeries[];
  lifeGraph: LifeGraph;
  review: WeeklyReviewResult & { weekStart: string };
  achievements: (AchievementDefinition & { unlockedAt: string | null })[];
  snapshotDays: number;
};

export type InsightsRepo = {
  getInsights(now?: Date): Promise<InsightsView>;
};

/* -------------------------------------------------------------------------- */
/*                              gathering inputs                              */
/* -------------------------------------------------------------------------- */

/**
 * Read everything the five scores need, in one pass.
 *
 * Each section resolves to `null` when the user has nothing in that area, and
 * `calc/pulse` then leaves that score out rather than scoring it zero.
 */
export async function gatherPulseInputs(
  userId: string,
  now: Date,
): Promise<PulseInputs> {
  const prisma = getPrisma();

  const weekStart = startOfWeek(now);
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [subjects, sessions, healthProfile, tasks, goal, skills, sleep, habits, habitLogs] =
    await Promise.all([
      prisma.subject.findMany({
        where: { userId },
        select: { classesHeld: true, classesAttended: true, minAttendancePct: true },
      }),
      prisma.workoutSession.findMany({
        where: { userId, date: { gte: weekStart } },
        select: { id: true },
      }),
      prisma.healthProfile.findUnique({ where: { userId } }),
      prisma.task.findMany({
        where: { userId },
        select: { done: true, due: true, completedAt: true },
      }),
      prisma.careerGoal.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: { requirements: true, roadmap: true },
      }),
      prisma.userSkill.findMany({ where: { userId } }),
      prisma.sleepLog.findMany({
        where: { userId, date: { gte: weekAgo } },
        select: { minutes: true },
      }),
      prisma.habit.findMany({ where: { userId }, select: { id: true, timesPerWeek: true } }),
      prisma.habitLog.findMany({
        where: { userId, date: { gte: weekStart }, done: true },
        select: { habitId: true },
      }),
    ]);

  /* ----------------------------- academic ------------------------------ */
  const held = subjects.reduce((total, subject) => total + subject.classesHeld, 0);
  const attended = subjects.reduce((total, subject) => total + subject.classesAttended, 0);
  const requiredPct =
    subjects.length > 0
      ? Math.round(
          subjects.reduce((total, subject) => total + subject.minAttendancePct, 0) /
            subjects.length,
        )
      : 75;

  const overdueTasks = tasks.filter(
    (task) => !task.done && task.due && task.due.getTime() < now.getTime(),
  ).length;

  const academic =
    subjects.length === 0 && overdueTasks === 0
      ? null
      : {
          attendancePct: held > 0 ? (attended / held) * 100 : null,
          requiredPct,
          overdueTasks,
        };

  /* ------------------------------ fitness ------------------------------ */
  const planned = healthProfile?.plannedPerWeek ?? 0;
  const fitness = planned > 0 ? { kept: sessions.length, planned } : null;

  /* --------------------------- productivity ---------------------------- */
  const completedThisWeek = tasks.filter(
    (task) => task.done && task.completedAt && task.completedAt >= weekAgo,
  ).length;
  const open = tasks.filter((task) => !task.done).length;

  const productivity =
    tasks.length === 0
      ? null
      : { completed: completedThisWeek, overdue: overdueTasks, open };

  /* ------------------------------- career ------------------------------ */
  const career = goal
    ? {
        readiness: skillGap(goal.requirements, skills).readiness,
        roadmapRatio: roadmapProgress(
          goal.roadmap.map((item) => ({
            done: item.done,
            dueDate: item.dueDate ? isoDate(item.dueDate) : null,
          })),
          now,
        ).ratio,
      }
    : null;

  /* ------------------------------ routine ------------------------------ */
  const habitTarget = habits.reduce((total, habit) => total + habit.timesPerWeek, 0);

  const routine =
    sleep.length === 0 && habitTarget === 0
      ? null
      : {
          nightsLogged: sleep.length,
          averageSleepMinutes:
            sleep.length > 0
              ? sleep.reduce((total, row) => total + row.minutes, 0) / sleep.length
              : 0,
          habitRatio:
            habitTarget > 0 ? Math.min(1, habitLogs.length / habitTarget) : null,
        };

  return { academic, fitness, productivity, career, routine };
}

/** The live pulse, for Home. */
export async function getLivePulse(userId: string, now: Date): Promise<PulseResult> {
  return computePulse(await gatherPulseInputs(userId, now), now);
}

/**
 * Write today's snapshot.
 *
 * Idempotent by the `[userId, date]` unique index: running the cron twice, or
 * running it after a lazy write on the user's first visit, updates the row
 * rather than adding a second one for the same day.
 */
export async function recordDailySnapshot(userId: string, date: Date): Promise<void> {
  const inputs = await gatherPulseInputs(userId, date);
  const row = pulseSnapshotRow(inputs, date);

  const day = new Date(date);
  day.setHours(0, 0, 0, 0);

  await getPrisma().pulseSnapshot.upsert({
    where: { userId_date: { userId, date: day } },
    create: { userId, date: day, ...row },
    update: row,
  });
}

/** Every user, for the cron endpoint. Returns how many rows were written. */
export async function recordSnapshotsForAllUsers(date: Date): Promise<number> {
  const users = await getPrisma().user.findMany({ select: { id: true } });

  let written = 0;
  for (const user of users) {
    /* Sequential rather than parallel: this runs once a day on a small
       connection pool, and a hundred concurrent transactions to save a few
       seconds is the wrong trade. */
    await recordDailySnapshot(user.id, date);
    written += 1;
  }

  return written;
}

/**
 * Store this week's review.
 *
 * Written by the cron rather than by the page, because a page render must not
 * have a side effect — Next may render it twice, and a retried render would
 * write twice. The stored row is what makes "has this week's review been
 * produced?" answerable, while the screen always recomputes from live data so
 * a review read on Friday is not Monday's.
 */
export async function recordWeeklyReview(userId: string, now: Date): Promise<void> {
  const prisma = getPrisma();
  const weekStart = startOfWeek(now);

  const inputs = await gatherPulseInputs(userId, now);

  const review = weeklyReview({
    workouts: inputs.fitness ?? null,
    tasks: inputs.productivity
      ? { completed: inputs.productivity.completed, overdue: inputs.productivity.overdue }
      : null,
    sleep: inputs.routine
      ? {
          nights: inputs.routine.nightsLogged,
          averageMinutes: inputs.routine.averageSleepMinutes,
        }
      : null,
  });

  await prisma.weeklyReview.upsert({
    where: { userId_weekStart: { userId, weekStart } },
    create: {
      userId,
      weekStart,
      wentWell: review.wentWell,
      slipped: review.slipped,
      nextFocus: review.nextFocus,
    },
    update: {
      wentWell: review.wentWell,
      slipped: review.slipped,
      nextFocus: review.nextFocus,
    },
  });
}

/** True when today's snapshot is missing, so Home can write it lazily. */
export async function needsSnapshot(userId: string, now: Date): Promise<boolean> {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);

  const existing = await getPrisma().pulseSnapshot.findUnique({
    where: { userId_date: { userId, date: day } },
    select: { id: true },
  });

  return existing === null;
}

/* -------------------------------------------------------------------------- */
/*                                  per user                                  */
/* -------------------------------------------------------------------------- */

export function insightsRepoForUser(userId: string): InsightsRepo {
  const prisma = getPrisma();

  return {
    async getInsights(now = new Date()) {
      await connection();

      const weekStart = startOfWeek(now);
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 29);

      const [snapshots, achievements, sleep, sessions, healthProfile, tasks, subjects, goal, expenses, financeProfile, meals] =
        await Promise.all([
          prisma.pulseSnapshot.findMany({
            where: { userId, date: { gte: monthAgo } },
            orderBy: { date: "asc" },
          }),
          prisma.achievement.findMany({ where: { userId } }),
          prisma.sleepLog.findMany({
            where: { userId, date: { gte: weekStart } },
            select: { minutes: true },
          }),
          prisma.workoutSession.findMany({
            where: { userId, date: { gte: weekStart } },
            select: { id: true },
          }),
          prisma.healthProfile.findUnique({ where: { userId } }),
          prisma.task.findMany({
            where: { userId },
            select: { done: true, due: true, completedAt: true },
          }),
          prisma.subject.findMany({
            where: { userId },
            select: {
              name: true,
              classesHeld: true,
              classesAttended: true,
              minAttendancePct: true,
            },
          }),
          prisma.careerGoal.findFirst({
            where: { userId },
            orderBy: { createdAt: "desc" },
            include: { roadmap: true },
          }),
          prisma.expense.findMany({
            where: { userId, date: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
            select: { amountMinor: true },
          }),
          prisma.financeProfile.findUnique({ where: { userId } }),
          prisma.mealLog.findMany({
            where: { userId, date: { gte: weekStart } },
            select: { date: true },
          }),
        ]);

      const rows: SnapshotRow[] = snapshots.map((row) => ({
        date: isoDate(row.date),
        academic: row.academic,
        fitness: row.fitness,
        productivity: row.productivity,
        career: row.career,
        routine: row.routine,
        momentum: row.momentum,
      }));

      /* The weekly review is recomputed from the week's data rather than only
         read back: a stored review from Monday is stale by Friday. The stored
         row exists so "have you read this week's review?" can be answered. */
      const review = weeklyReview({
        workouts:
          healthProfile && healthProfile.plannedPerWeek > 0
            ? { kept: sessions.length, planned: healthProfile.plannedPerWeek }
            : null,
        tasks: {
          completed: tasks.filter(
            (task) => task.done && task.completedAt && task.completedAt >= weekStart,
          ).length,
          overdue: tasks.filter(
            (task) => !task.done && task.due && task.due.getTime() < now.getTime(),
          ).length,
        },
        attendance: subjects
          .filter((subject) => subject.classesHeld > 0)
          .map((subject) => ({
            subject: subject.name,
            pct: (subject.classesAttended / subject.classesHeld) * 100,
            required: subject.minAttendancePct,
          })),
        sleep:
          sleep.length > 0
            ? {
                nights: sleep.length,
                averageMinutes:
                  sleep.reduce((total, row) => total + row.minutes, 0) / sleep.length,
              }
            : null,
        nutrition: { daysLogged: new Set(meals.map((row) => isoDate(row.date))).size },
        money: financeProfile
          ? {
              spentMinor: expenses.reduce((total, row) => total + row.amountMinor, 0),
              budgetMinor: financeProfile.monthlyBudgetMinor,
            }
          : null,
        career: goal
          ? { itemsDone: goal.roadmap.filter((item) => item.done).length }
          : null,
      });

      const unlocked = new Map(
        achievements.map((row) => [row.key, isoDate(row.unlockedAt)]),
      );

      return {
        evolution: twinEvolution(rows, 30, now),
        lifeGraph: lifeGraph(buildLifeSeries(rows)),
        review: { ...review, weekStart: isoDate(weekStart) },
        achievements: ACHIEVEMENTS.map((definition) => ({
          ...definition,
          unlockedAt: unlocked.get(definition.key) ?? null,
        })),
        snapshotDays: rows.length,
      };
    },
  };
}

/**
 * The series the Life Graph correlates.
 *
 * Built from the snapshots rather than from raw logs, because the snapshots
 * are already one value per day per area — which is exactly the shape a
 * correlation needs, and avoids re-reading a month of every table.
 */
function buildLifeSeries(rows: SnapshotRow[]): DaySeries[] {
  const pick = (key: keyof Omit<SnapshotRow, "date">) =>
    rows.map((row) => (row[key] > 0 ? row[key] : null));

  return [
    { id: "routine", label: "Routine", values: pick("routine") },
    { id: "productivity", label: "Productivity", values: pick("productivity") },
    { id: "fitness", label: "Fitness", values: pick("fitness") },
    { id: "academic", label: "Academic", values: pick("academic") },
  ];
}

/** Unlock anything the user's data now satisfies. Called after the snapshot. */
export async function syncAchievements(userId: string, now: Date): Promise<void> {
  const prisma = getPrisma();

  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 29);

  const [snapshots, goals, reviews] = await Promise.all([
    prisma.pulseSnapshot.findMany({
      where: { userId, date: { gte: monthAgo } },
      orderBy: { date: "asc" },
      select: { date: true, fitness: true },
    }),
    prisma.savingsGoal.findMany({ where: { userId } }),
    prisma.weeklyReview.count({ where: { userId } }),
  ]);

  const keys: AchievementKey[] = evaluateAchievements({
    consecutiveLoggedDays: longestRun(snapshots.map((row) => isoDate(row.date))),
    /* A week counts as consistent when its fitness score was full marks. */
    consistentWorkoutWeeks: Math.floor(
      snapshots.filter((row) => row.fitness >= 100).length / 7,
    ),
    attendanceRecovered: false,
    savingsGoalReached: goals.some(
      (goal) => goal.targetMinor > 0 && goal.savedMinor >= goal.targetMinor,
    ),
    weeklyReviewsRead: reviews,
    snapshotDays: snapshots.length,
  });

  for (const key of keys) {
    await prisma.achievement.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key },
      update: {},
    });
  }
}

/** Longest run of consecutive dates in a sorted list of yyyy-mm-dd strings. */
function longestRun(dates: string[]): number {
  if (dates.length === 0) return 0;

  let best = 1;
  let run = 1;

  for (let index = 1; index < dates.length; index += 1) {
    const previous = new Date(dates[index - 1]).getTime();
    const current = new Date(dates[index]).getTime();

    if (current - previous === 86_400_000) {
      run += 1;
      best = Math.max(best, run);
    } else if (current !== previous) {
      run = 1;
    }
  }

  return best;
}

/* -------------------------------------------------------------------------- */
/*                                    demo                                    */
/* -------------------------------------------------------------------------- */

export const demoInsightsRepo: InsightsRepo = {
  async getInsights(now = new Date()) {
    await connection();
    return insightsView(now);
  },
};
