/**
 * The single data boundary for every screen.
 *
 * Screens `await repo.getX()` and never import fixtures. When the database and
 * API arrive, this file is the only thing that changes: each function becomes a
 * Prisma query or a fetch, and no screen is touched.
 *
 * Every read awaits `connection()` first. These views are per-user and
 * time-sensitive — "due tomorrow" and "good evening" are only true for one
 * request — so they are rendered at request time rather than prerendered.
 */

import { connection } from "next/server";

import * as fixtures from "@/lib/data/fixtures";
import type { TwinSnapshot } from "@/lib/domain/types";

export const repo = {
  /** Everything the Twin Home screen needs in one read. */
  async getTwinSnapshot(): Promise<TwinSnapshot> {
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

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
