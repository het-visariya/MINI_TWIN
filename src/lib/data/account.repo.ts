/**
 * The Privacy & control module's data boundary, and the export.
 *
 * The export is the part worth reading carefully. `EXPORTED_MODELS` is the
 * single list that drives it, and it is derived from the schema's own rule —
 * every domain table carries a `userId` — so adding a model to the schema and
 * forgetting it here is the one failure mode. `assertExportCoversSchema` exists
 * to turn that from a silent omission into a test failure.
 *
 * Three things never leave: the password hash on Account, session tokens, and
 * the verification table. An export is for the user's own data, not for a
 * complete copy of their credentials.
 */

import { connection } from "next/server";

import { accountView } from "@/lib/data/module-fixtures";
import { getPrisma } from "@/lib/db";

/* -------------------------------------------------------------------------- */
/*                                   views                                    */
/* -------------------------------------------------------------------------- */

export type ConsentRecord = {
  id: string;
  feature: string;
  categories: string[];
  summary: string;
  model: string | null;
  granted: boolean;
  createdAt: string;
};

export type SessionRecord = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  /** True for the session making this request. */
  current: boolean;
};

export type AccountView = {
  profile: {
    name: string;
    email: string;
    lifeStage: "SCHOOL" | "COLLEGE" | "OTHER" | null;
    regreterTone: "GENTLE" | "BALANCED" | "DIRECT" | "NO_MERCY";
    aiConsentAt: string | null;
    allowHealthDataToAi: boolean;
    allowMoneyDataToAi: boolean;
  };
  consentLog: ConsentRecord[];
  sessions: SessionRecord[];
  /** Row counts per model, so "delete everything" states what everything is. */
  dataSummary: { label: string; count: number }[];
};

export type AccountRepo = {
  getAccount(currentSessionToken?: string): Promise<AccountView>;
};

/* -------------------------------------------------------------------------- */
/*                              the export list                               */
/* -------------------------------------------------------------------------- */

/**
 * Every table the export walks, with the Prisma delegate name and a label.
 *
 * Kept as data rather than as thirty hand-written queries so that the export,
 * the deletion summary and the test that checks for gaps all read the same
 * list.
 */
export const EXPORTED_MODELS = [
  ["profile", "Profile"],
  ["subject", "Subjects"],
  ["attendanceRecord", "Attendance records"],
  ["commitment", "Commitments"],
  ["task", "Tasks"],
  ["goal", "Goals"],
  ["habit", "Habits"],
  ["habitLog", "Habit logs"],
  ["healthProfile", "Health profile"],
  ["workoutSession", "Workout sessions"],
  ["workoutSet", "Workout sets"],
  ["weightLog", "Weight log"],
  ["sleepLog", "Sleep log"],
  ["waterLog", "Water log"],
  ["moodCheckin", "Mood check-ins"],
  ["dietProfile", "Diet profile"],
  ["mealLog", "Meal logs"],
  ["mealItem", "Meal items"],
  ["savedMeal", "Saved meals"],
  ["financeProfile", "Finance profile"],
  ["expense", "Expenses"],
  ["subscription", "Subscriptions"],
  ["savingsGoal", "Savings goals"],
  ["investment", "Investments"],
  ["careerGoal", "Career goals"],
  ["userSkill", "Skills"],
  ["certification", "Certifications"],
  ["project", "Projects"],
  ["placementStatus", "Placement status"],
  ["roadmapItem", "Roadmap items"],
  ["pulseSnapshot", "Daily snapshots"],
  ["weeklyReview", "Weekly reviews"],
  ["achievement", "Milestones"],
  ["notification", "Notifications"],
  ["reminderRule", "Reminder rules"],
  ["notificationPrefs", "Notification preferences"],
  ["aiConsentLog", "AI consent log"],
  ["twinMessage", "Twin conversations"],
] as const satisfies readonly (readonly [string, string])[];

/**
 * Build the whole export.
 *
 * Every query filters by `userId`, so there is no shape of this function that
 * returns another user's rows — the filter is not a condition that could be
 * forgotten on one branch, it is applied uniformly by the loop.
 */
export async function buildExport(userId: string) {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    /* Explicit select, not the whole row: `select` is what keeps a future
       column off the export by default rather than on it. */
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) throw new Error("Not signed in.");

  const data: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    note:
      "Everything Digital Twin holds about you, except your password hash, your session tokens and email-verification records. Those are credentials, not data about you.",
    user,
  };

  for (const [delegate, label] of EXPORTED_MODELS) {
    const client = prisma as unknown as Record<
      string,
      { findMany: (args: unknown) => Promise<unknown[]> }
    >;

    const rows = await client[delegate].findMany({ where: { userId } });
    data[delegate] = rows;
    void label;
  }

  return data;
}

/**
 * Row counts for the delete confirmation.
 *
 * "This removes everything" is a claim; a list of counts is the evidence for
 * it, and it lets the user see there is nothing they have forgotten about.
 */
export async function dataSummaryFor(userId: string) {
  const prisma = getPrisma();

  const summary: { label: string; count: number }[] = [];

  for (const [delegate, label] of EXPORTED_MODELS) {
    const client = prisma as unknown as Record<
      string,
      { count: (args: unknown) => Promise<number> }
    >;

    const count = await client[delegate].count({ where: { userId } });
    if (count > 0) summary.push({ label, count });
  }

  return summary;
}

/* -------------------------------------------------------------------------- */
/*                                  per user                                  */
/* -------------------------------------------------------------------------- */

export function accountRepoForUser(userId: string): AccountRepo {
  const prisma = getPrisma();

  return {
    async getAccount(currentSessionToken) {
      await connection();

      const [user, profile, consentLog, sessions] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        }),
        prisma.profile.findUnique({ where: { userId } }),
        prisma.aiConsentLog.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.session.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      return {
        profile: {
          name: user?.name ?? "",
          email: user?.email ?? "",
          lifeStage: (profile?.lifeStage ?? null) as AccountView["profile"]["lifeStage"],
          regreterTone: (profile?.regreterTone ??
            "BALANCED") as AccountView["profile"]["regreterTone"],
          aiConsentAt: profile?.aiConsentAt ? profile.aiConsentAt.toISOString() : null,
          allowHealthDataToAi: profile?.allowHealthDataToAi ?? false,
          allowMoneyDataToAi: profile?.allowMoneyDataToAi ?? false,
        },

        consentLog: consentLog.map((row) => ({
          id: row.id,
          feature: row.feature,
          categories: row.categories,
          summary: row.summary,
          model: row.model,
          granted: row.granted,
          createdAt: row.createdAt.toISOString(),
        })),

        sessions: sessions.map((row) => ({
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          expiresAt: row.expiresAt.toISOString(),
          ipAddress: row.ipAddress,
          userAgent: row.userAgent,
          current: currentSessionToken !== undefined && row.token === currentSessionToken,
        })),

        dataSummary: await dataSummaryFor(userId),
      };
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                    demo                                    */
/* -------------------------------------------------------------------------- */

export const demoAccountRepo: AccountRepo = {
  async getAccount() {
    await connection();
    return accountView();
  },
};
