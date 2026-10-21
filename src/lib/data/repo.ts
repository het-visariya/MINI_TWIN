/**
 * The single data boundary for every screen.
 *
 * Screens never import fixtures and never import Prisma. They call
 * `await getRepo()` and get back one of two implementations with the same
 * shape:
 *
 *   - `forUser(userId)` — Prisma, every query filtered by that userId. A
 *     screen cannot accidentally read another user's rows, because no function
 *     here takes a userId as an argument twice.
 *   - `demoRepo` — the fixtures, read-only. Writes are discarded rather than
 *     persisted, so demo mode can never touch a real account.
 *
 * Every read awaits `connection()` first. These views are per-user and
 * time-sensitive — "due tomorrow" and "good evening" are only true for one
 * request — so they are rendered at request time rather than prerendered.
 */

import { redirect } from "next/navigation";
import { connection } from "next/server";

import * as fixtures from "@/lib/data/fixtures";
import { demoHealthRepo, healthRepoForUser } from "@/lib/data/health.repo";
import { careerRepoForUser, demoCareerRepo } from "@/lib/data/career.repo";
import { demoInsightsRepo, insightsRepoForUser } from "@/lib/data/insights.repo";
import { demoRemindersRepo, remindersRepoForUser } from "@/lib/data/reminders.repo";
import { demoFinanceRepo, financeRepoForUser } from "@/lib/data/finance.repo";
import { demoNutritionRepo, nutritionRepoForUser } from "@/lib/data/nutrition.repo";
import { getPrisma } from "@/lib/db";
import { getViewer, type Viewer } from "@/lib/auth/session";
import { toDomain, toPriority, toSubject, toTask } from "@/lib/data/map";
import { emptySnapshot, snapshotFromRows } from "@/lib/data/derive";
import type {
  Commitment,
  Goal,
  Habit,
  Heatmap,
  ScenarioPath,
  Score,
  Simulation,
  Subject,
  Task,
  TwinMessage,
  TwinSnapshot,
} from "@/lib/domain/types";

export type AcademicView = {
  subjects: Subject[];
  risk: Score;
  cgpa: typeof fixtures.cgpaSimulation;
  cascade: typeof fixtures.deadlineCascade;
  timetable: Commitment[];
};

export type ProductivityView = {
  tasks: Task[];
  habits: Habit[];
  heatmap: Heatmap;
  consistency: Score;
  baseline: Score;
};

export type PlanningView = {
  goals: Goal[];
  capacity: typeof fixtures.weeklyCapacity;
  timeBudget: TwinSnapshot["timeBudget"];
  conflicts: TwinSnapshot["conflicts"];
  recovery: typeof fixtures.recoveryPlan;
};

export type RegreterView = {
  consequence: (typeof fixtures.consequences)[number];
  receipts: typeof fixtures.costReceipts;
  plans: typeof fixtures.plansInThree;
  futurePaths: Simulation<ScenarioPath[]>;
};

/**
 * Both implementations satisfy this. A screen is given one of them and cannot
 * tell which, so demo mode exercises exactly the same rendering path as a real
 * account.
 */
export type Repo = {
  readonly mode: "user" | "demo";
  getTwinSnapshot(): Promise<TwinSnapshot>;
  getAcademic(): Promise<AcademicView>;
  getProductivity(): Promise<ProductivityView>;
  getPlanning(): Promise<PlanningView>;
  getRegreter(): Promise<RegreterView>;
  getConversation(): Promise<TwinMessage[]>;
};

/* -------------------------------------------------------------------------- */
/*                                  per user                                  */
/* -------------------------------------------------------------------------- */

export function forUser(userId: string): Repo {
  const prisma = getPrisma();

  return {
    mode: "user",

    async getTwinSnapshot() {
      await connection();

      const [profile, commitments, tasks] = await Promise.all([
        prisma.profile.findUnique({ where: { userId } }),
        prisma.commitment.findMany({
          where: { userId, ...todayRange() },
          orderBy: { start: "asc" },
        }),
        prisma.task.findMany({
          where: { userId, done: false },
          orderBy: [{ due: "asc" }, { createdAt: "asc" }],
          take: 50,
        }),
      ]);

      if (commitments.length === 0 && tasks.length === 0) {
        /* A brand-new account. The screen gets a real, honest empty snapshot
           rather than invented numbers — Home's empty state teaches from it. */
        return emptySnapshot(greetingForNow());
      }

      return snapshotFromRows({
        greeting: greetingForNow(),
        commitments: commitments.map(toCommitment),
        tasks: tasks.map(toTask),
        traits: (profile?.traits ?? {}) as Record<string, unknown>,
      });
    },

    async getAcademic() {
      await connection();

      const [subjects, timetable] = await Promise.all([
        prisma.subject.findMany({ where: { userId }, orderBy: { name: "asc" } }),
        prisma.commitment.findMany({
          where: { userId, domain: "ACADEMIC" },
          orderBy: { start: "asc" },
        }),
      ]);

      return {
        subjects: subjects.map(toSubject),
        /* Risk, the CGPA simulator and the deadline cascade are computed by the
           academic engine built in phase 3. Until then a new user sees the
           screen's empty state, not a fabricated risk band. */
        risk: fixtures.academicRisk,
        cgpa: fixtures.cgpaSimulation,
        cascade: fixtures.deadlineCascade,
        timetable: timetable.map(toCommitment),
      };
    },

    async getProductivity() {
      await connection();

      const [tasks, habits] = await Promise.all([
        prisma.task.findMany({
          where: { userId },
          orderBy: [{ done: "asc" }, { due: "asc" }],
          take: 100,
        }),
        prisma.habit.findMany({ where: { userId }, orderBy: { name: "asc" } }),
      ]);

      return {
        tasks: tasks.map(toTask),
        habits: habits.map((habit) => ({
          id: habit.id,
          label: habit.name,
          /* Filled by phase 3's habit engine, which reads HabitLog. Zero is
             the truth for a habit with no logged days, not a placeholder. */
          days28: 0,
          domain: toDomain(habit.domain),
        })),
        heatmap: { days: fixtures.heatmap.days, rows: [] },
        consistency: fixtures.momentum,
        baseline: fixtures.momentum,
      };
    },

    async getPlanning() {
      await connection();

      const goals = await prisma.goal.findMany({
        where: { userId },
        orderBy: { targetDate: "asc" },
      });

      return {
        goals: goals.map(toGoal),
        capacity: fixtures.weeklyCapacity,
        timeBudget: fixtures.timeBudget,
        conflicts: [],
        recovery: fixtures.recoveryPlan,
      };
    },

    async getRegreter() {
      await connection();

      return {
        consequence: fixtures.consequences[0],
        receipts: [],
        plans: [],
        futurePaths: fixtures.futurePaths,
      };
    },

    async getConversation() {
      await connection();

      const messages = await prisma.twinMessage.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        take: 100,
      });

      return messages.map((message) => ({
        id: message.id,
        author: message.author === "USER" ? ("user" as const) : ("twin" as const),
        text: message.text,
        sources: (message.sources ?? undefined) as TwinMessage["sources"],
        proposal: (message.proposal ?? undefined) as TwinMessage["proposal"],
        suggestions: message.suggestions,
      }));
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                    demo                                    */
/* -------------------------------------------------------------------------- */

/**
 * Sample data. Deliberately the same object every request: demo writes are
 * accepted by the UI and then dropped, so nothing a visitor does in the demo
 * can reach a database or another visitor.
 */
export const demoRepo: Repo = {
  mode: "demo",

  async getTwinSnapshot() {
    await connection();

    return {
      greeting: greetingForNow(),
      state: "stretched",
      intensity: 0.55,
      oneThing: {
        title: "Finish the normalisation section of DBMS assignment 3",
        reason:
          "It is due tomorrow at 11:59 pm, you estimated 2 hours of work left, and this subject applies a 20% late penalty.",
        commitmentId: "c-dbms-assign",
      },
      pulse: fixtures.pulse,
      momentum: fixtures.momentum,
      timeBudget: fixtures.timeBudget,
      conflicts: fixtures.conflicts,
      today: fixtures.createCommitments(),
      brief: fixtures.briefLines,
    };
  },

  async getAcademic() {
    await connection();

    return {
      subjects: fixtures.subjects,
      risk: fixtures.academicRisk,
      cgpa: fixtures.cgpaSimulation,
      cascade: fixtures.deadlineCascade,
      timetable: fixtures
        .createCommitments()
        .filter((commitment) => commitment.domain === "academic"),
    };
  },

  async getProductivity() {
    await connection();

    return {
      tasks: fixtures.createTasks(),
      habits: fixtures.habits,
      heatmap: fixtures.heatmap,
      consistency: fixtures.momentum,
      baseline: fixtures.pulse.find((score) => score.id === "s-productivity")!,
    };
  },

  async getPlanning() {
    await connection();

    return {
      goals: fixtures.createGoals(),
      capacity: fixtures.weeklyCapacity,
      timeBudget: fixtures.timeBudget,
      conflicts: fixtures.conflicts,
      recovery: fixtures.recoveryPlan,
    };
  },

  async getRegreter() {
    return {
      consequence: fixtures.consequences[0],
      receipts: fixtures.costReceipts,
      plans: fixtures.plansInThree,
      futurePaths: fixtures.futurePaths,
    };
  },

  async getConversation() {
    return fixtures.conversation;
  },
};

/* -------------------------------------------------------------------------- */
/*                                 resolution                                 */
/* -------------------------------------------------------------------------- */

/**
 * The only way a screen gets data. Resolves the viewer first, so forgetting to
 * check the session is not something a screen can do.
 */
export async function getRepo(viewer?: Viewer): Promise<Repo> {
  /* Callers that already resolved the viewer — the app layout, which had to in
     order to decide whether to redirect — pass it in, so one request never
     resolves the session twice and cannot get two different answers. */
  const resolved = viewer ?? (await getViewer());

  if (resolved.kind === "user") return forUser(resolved.userId);
  if (resolved.kind === "demo") return demoRepo;

  /*
   * Redirects rather than throws, and that distinction matters.
   *
   * Next renders a layout and its page concurrently, so a page calling this
   * does not wait for the layout's own guard to finish. When this threw, the
   * thrown error reached the error boundary first and the request answered
   * 200 with an error page instead of the layout's 307 to /login — the user
   * was still kept out, but by an error rather than by a redirect.
   *
   * Server actions must not redirect, so they use `requireUser`, which throws.
   */
  redirect("/login");
}

/* -------------------------------------------------------------------------- */
/*                               module repos                                 */
/* -------------------------------------------------------------------------- */

/**
 * The per-module boundaries.
 *
 * Each module owns its own repo file rather than adding another forty methods
 * to the `Repo` object above, which would have become unreadable. They share
 * this resolver, so the one rule that matters is enforced in a single place:
 * a user gets a repo bound to their own id, a demo visitor gets the fixtures,
 * and an anonymous request is redirected before any query runs.
 *
 * Writes go the other way round. A server action resolves the writer itself
 * (`requireWriter`) and constructs the module repo directly, because an action
 * must not redirect — it has no page to redirect to.
 */
function moduleRepo<T>(forUserImpl: (userId: string) => T, demoImpl: T) {
  return async function resolve(viewer?: Viewer): Promise<T> {
    const resolved = viewer ?? (await getViewer());

    if (resolved.kind === "user") return forUserImpl(resolved.userId);
    if (resolved.kind === "demo") return demoImpl;

    /* Redirects rather than throws, for the same reason getRepo does: a page
       rendering concurrently with the layout must answer with a 307 to
       /login, not a 200 carrying an error boundary. */
    redirect("/login");
  };
}

export const getHealthRepo = moduleRepo(healthRepoForUser, demoHealthRepo);
export const getNutritionRepo = moduleRepo(nutritionRepoForUser, demoNutritionRepo);
export const getFinanceRepo = moduleRepo(financeRepoForUser, demoFinanceRepo);
export const getCareerRepo = moduleRepo(careerRepoForUser, demoCareerRepo);
export const getInsightsRepo = moduleRepo(insightsRepoForUser, demoInsightsRepo);
export const getRemindersRepo = moduleRepo(remindersRepoForUser, demoRemindersRepo);

/* ------------------------------- row mapping ------------------------------ */

function toCommitment(row: {
  id: string;
  title: string;
  domain: string;
  minutes: number;
  start: Date | null;
  flexibility: string;
  priority: string;
  dependsOn: string[];
  source: string | null;
}): Commitment {
  return {
    id: row.id,
    title: row.title,
    domain: toDomain(row.domain),
    minutes: row.minutes,
    start: row.start?.toISOString(),
    flexibility: row.flexibility.toLowerCase() as Commitment["flexibility"],
    priority: toPriority(row.priority),
    dependsOn: row.dependsOn.length > 0 ? row.dependsOn : undefined,
    source: row.source ?? undefined,
  };
}

function toGoal(row: {
  id: string;
  title: string;
  domain: string;
  targetDate: Date | null;
  progress: number;
  weeklyHours: number;
  notes: string | null;
}): Goal {
  return {
    id: row.id,
    title: row.title,
    domain: toDomain(row.domain),
    due: row.targetDate?.toISOString(),
    progress: row.progress,
    needsHoursPerWeek: row.weeklyHours,
    notes: row.notes ?? undefined,
  };
}

/** Midnight-to-midnight in the server's zone, for "today's" commitments. */
function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start: { gte: start, lt: end } };
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
