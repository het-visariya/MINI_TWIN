/**
 * Writing to a plan: tasks, commitments and goals.
 *
 * These three models were read-only until now — seeded and displayed, never
 * written by any screen. This file is the first write path, and it is shaped
 * around the fact that the twin will use it too.
 *
 * Three properties hold for every mutation here, and they are the reason this
 * is not just a thin wrapper over Prisma:
 *
 *   1. **Scoped.** Every statement filters by `userId`. Reads of a single row
 *      use `findFirst({ where: { id, userId } })`, so another user's id reads
 *      as "not found" rather than as a permission error — safer, and less
 *      informative to someone probing ids.
 *   2. **Checked.** Placement goes through `planning-rules`, the same pure
 *      functions the UI and the suggestion engine use. A rule enforced here
 *      and not there, or the reverse, is how a plan becomes invalid.
 *   3. **Reversible.** Each mutation returns the values it overwrote, so the
 *      caller can record an undo without reading the row again and racing
 *      whoever else is editing.
 *
 * Failures are returned, not thrown. "Lab is fixed, it cannot be moved" is an
 * answer the user needs to read, not an exception for a log file.
 */

import { getPrisma } from "@/lib/db";
import {
  checkDayPlan,
  checkPlacement,
  checkReschedule,
  explainFailures,
  type RuleFailure,
  type Slot,
} from "@/lib/domain/calc/planning-rules";
import type {
  AdjustGoalInput,
  CompleteTaskInput,
  CreateCommitmentInput,
  CreateGoalInput,
  CreateTaskInput,
  RebuildDayInput,
  RescheduleCommitmentInput,
  RescheduleTaskInput,
  UpdateTaskInput,
} from "@/lib/validation/planning";

/** What every mutation answers with. `previous` is what undo needs. */
export type WriteResult<T = undefined> =
  | { ok: true; id: string; previous?: T }
  | { ok: false; reason: string; failures?: RuleFailure[] };

const notFound = (what: string): WriteResult<never> => ({
  ok: false,
  reason: `That ${what} could not be found.`,
});

function refused(failures: RuleFailure[]): WriteResult<never> {
  return { ok: false, reason: explainFailures(failures), failures };
}

/* -------------------------------------------------------------------------- */

export type TaskSnapshot = {
  title: string;
  due: Date | null;
  estimateMinutes: number;
  priority: string;
  progress: number;
  done: boolean;
};

export type CommitmentSnapshot = { start: Date | null };

export type GoalSnapshot = {
  targetDate: Date | null;
  progress: number;
  weeklyHours: number;
};

export function planningRepoForUser(userId: string) {
  const prisma = getPrisma();

  /** The day a commitment sits on, as the rules want it. */
  async function dayAround(start: Date): Promise<Slot[]> {
    const from = new Date(start);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);

    const rows = await prisma.commitment.findMany({
      where: {
        userId,
        /* Unscheduled items are included: they carry dependencies, and a
           dependency with no time is itself a rule failure. */
        OR: [{ start: { gte: from, lt: to } }, { start: null }],
      },
    });

    return rows.map(toSlot);
  }

  return {
    /* ---------------------------------------------------------------- */
    /*                               tasks                               */
    /* ---------------------------------------------------------------- */

    async createTask(input: CreateTaskInput): Promise<WriteResult> {
      const row = await prisma.task.create({
        data: {
          userId,
          title: input.title,
          domain: input.domain,
          due: input.due ?? null,
          estimateMinutes: input.estimateMinutes,
          priority: input.priority,
          why: input.why ?? null,
        },
        select: { id: true },
      });

      return { ok: true, id: row.id };
    },

    async updateTask(input: UpdateTaskInput): Promise<WriteResult<TaskSnapshot>> {
      const existing = await prisma.task.findFirst({
        where: { id: input.taskId, userId },
      });
      if (!existing) return notFound("task");

      await prisma.task.update({
        where: { id: existing.id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.domain !== undefined && { domain: input.domain }),
          ...(input.due !== undefined && { due: input.due }),
          ...(input.estimateMinutes !== undefined && {
            estimateMinutes: input.estimateMinutes,
          }),
          ...(input.priority !== undefined && { priority: input.priority }),
          ...(input.progress !== undefined && { progress: input.progress }),
          ...(input.why !== undefined && { why: input.why }),
        },
      });

      return { ok: true, id: existing.id, previous: snapshotTask(existing) };
    },

    /**
     * Move a task's deadline. The twin's `reschedule_task` lands here.
     *
     * A task has a deadline, not a slot, so none of the placement rules
     * apply — a day can hold any number of things due in it. The scheduling
     * rules belong to commitments.
     */
    async rescheduleTask(
      input: RescheduleTaskInput,
    ): Promise<WriteResult<TaskSnapshot>> {
      const existing = await prisma.task.findFirst({
        where: { id: input.taskId, userId },
      });
      if (!existing) return notFound("task");

      await prisma.task.update({
        where: { id: existing.id },
        data: { due: input.due },
      });

      return { ok: true, id: existing.id, previous: snapshotTask(existing) };
    },

    async completeTask(input: CompleteTaskInput): Promise<WriteResult<TaskSnapshot>> {
      const existing = await prisma.task.findFirst({
        where: { id: input.taskId, userId },
      });
      if (!existing) return notFound("task");

      /* Idempotent: completing a completed task is not an error, and undo
         works by calling this with done:false rather than a second verb. */
      await prisma.task.update({
        where: { id: existing.id },
        data: {
          done: input.done,
          completedAt: input.done ? new Date() : null,
          /* Marking done implies finished. Reopening does not imply unstarted,
             so progress is left alone in that direction. */
          ...(input.done && existing.progress < 100 ? { progress: 100 } : {}),
        },
      });

      return { ok: true, id: existing.id, previous: snapshotTask(existing) };
    },

    async deleteTask(taskId: string): Promise<WriteResult> {
      const deleted = await prisma.task.deleteMany({ where: { id: taskId, userId } });
      if (deleted.count === 0) return notFound("task");

      return { ok: true, id: taskId };
    },

    /* ---------------------------------------------------------------- */
    /*                            commitments                            */
    /* ---------------------------------------------------------------- */

    async createCommitment(input: CreateCommitmentInput): Promise<WriteResult> {
      if (input.start) {
        const day = await dayAround(input.start);
        const candidate: Slot = {
          id: "new",
          title: input.title,
          start: input.start,
          minutes: input.minutes,
          flexibility: input.flexibility,
          dependsOn: input.dependsOn,
        };

        /* Placement, not reschedule: a FIXED commitment may be created at a
           time, it simply may not be moved afterwards. */
        const verdict = checkPlacement({ candidate, to: input.start, day });
        if (!verdict.ok) return refused(verdict.failures);
      }

      const row = await prisma.commitment.create({
        data: {
          userId,
          title: input.title,
          domain: input.domain,
          minutes: input.minutes,
          start: input.start ?? null,
          flexibility: input.flexibility,
          priority: input.priority,
          dependsOn: input.dependsOn,
          source: input.source ?? null,
        },
        select: { id: true },
      });

      return { ok: true, id: row.id };
    },

    /**
     * Move one commitment.
     *
     * The read, the check and the write are one transaction: between reading
     * the day and writing the move, another request could place something in
     * the slot this one just proved empty.
     */
    async rescheduleCommitment(
      input: RescheduleCommitmentInput,
      options: { now?: Date } = {},
    ): Promise<WriteResult<CommitmentSnapshot>> {
      return prisma.$transaction(async (tx) => {
        const existing = await tx.commitment.findFirst({
          where: { id: input.commitmentId, userId },
        });
        if (!existing) return notFound("commitment");

        const reference = input.start ?? existing.start;
        let day: Slot[] = [];

        if (reference) {
          const from = new Date(reference);
          from.setHours(0, 0, 0, 0);
          const to = new Date(from);
          to.setDate(to.getDate() + 1);

          const rows = await tx.commitment.findMany({
            where: {
              userId,
              OR: [{ start: { gte: from, lt: to } }, { start: null }],
            },
          });
          day = rows.map(toSlot);
        }

        const verdict = checkReschedule({
          moving: toSlot(existing),
          to: input.start,
          day,
          now: options.now,
        });
        if (!verdict.ok) return refused(verdict.failures);

        await tx.commitment.update({
          where: { id: existing.id },
          data: { start: input.start },
        });

        return {
          ok: true as const,
          id: existing.id,
          previous: { start: existing.start },
        };
      });
    },

    /**
     * Apply a whole rebuilt day.
     *
     * One transaction and one whole-day check, because an arrangement can be
     * valid as a whole while every intermediate state is not: A can only take
     * B's slot once B has left it. Validating move by move would reject the
     * swap the twin most often wants to propose.
     */
    async rebuildDay(
      input: RebuildDayInput,
    ): Promise<WriteResult<{ commitmentId: string; start: Date | null }[]>> {
      return prisma.$transaction(async (tx) => {
        const ids = input.moves.map((move) => move.commitmentId);

        const rows = await tx.commitment.findMany({ where: { userId, id: { in: ids } } });

        if (rows.length !== ids.length) {
          /* Fails whole rather than applying the subset it recognises: half a
             rebuild is an arrangement nobody asked for. */
          return {
            ok: false as const,
            reason:
              "Some of those have changed since I suggested this. Ask again and I'll look at the current plan.",
          };
        }

        const anchor = rows.find((row) => row.start)?.start ?? new Date();
        const from = new Date(anchor);
        from.setHours(0, 0, 0, 0);
        const to = new Date(from);
        to.setDate(to.getDate() + 1);

        const context = await tx.commitment.findMany({
          where: { userId, OR: [{ start: { gte: from, lt: to } }, { start: null }] },
        });

        const original = context.map(toSlot);
        const moveBy = new Map(input.moves.map((move) => [move.commitmentId, move.start]));

        const rebuilt = original.map((slot) =>
          moveBy.has(slot.id) ? { ...slot, start: moveBy.get(slot.id)! } : slot,
        );

        const verdict = checkDayPlan({ day: rebuilt, original });
        if (!verdict.ok) return refused(verdict.failures);

        const previous = rows.map((row) => ({
          commitmentId: row.id,
          start: row.start,
        }));

        for (const move of input.moves) {
          await tx.commitment.update({
            where: { id: move.commitmentId },
            data: { start: move.start },
          });
        }

        return { ok: true as const, id: "day", previous };
      });
    },

    async deleteCommitment(commitmentId: string): Promise<WriteResult> {
      const deleted = await prisma.commitment.deleteMany({
        where: { id: commitmentId, userId },
      });
      if (deleted.count === 0) return notFound("commitment");

      return { ok: true, id: commitmentId };
    },

    /* ---------------------------------------------------------------- */
    /*                               goals                               */
    /* ---------------------------------------------------------------- */

    async createGoal(input: CreateGoalInput): Promise<WriteResult> {
      const row = await prisma.goal.create({
        data: {
          userId,
          title: input.title,
          domain: input.domain,
          targetDate: input.targetDate ?? null,
          weeklyHours: input.weeklyHours,
          notes: input.notes ?? null,
        },
        select: { id: true },
      });

      return { ok: true, id: row.id };
    },

    async adjustGoal(input: AdjustGoalInput): Promise<WriteResult<GoalSnapshot>> {
      const existing = await prisma.goal.findFirst({
        where: { id: input.goalId, userId },
      });
      if (!existing) return notFound("goal");

      await prisma.goal.update({
        where: { id: existing.id },
        data: {
          ...(input.targetDate !== undefined && { targetDate: input.targetDate }),
          ...(input.progress !== undefined && { progress: input.progress }),
          ...(input.weeklyHours !== undefined && { weeklyHours: input.weeklyHours }),
        },
      });

      return {
        ok: true,
        id: existing.id,
        previous: {
          targetDate: existing.targetDate,
          progress: existing.progress,
          weeklyHours: existing.weeklyHours,
        },
      };
    },

    async deleteGoal(goalId: string): Promise<WriteResult> {
      const deleted = await prisma.goal.deleteMany({ where: { id: goalId, userId } });
      if (deleted.count === 0) return notFound("goal");

      return { ok: true, id: goalId };
    },
  };
}

export type PlanningRepo = ReturnType<typeof planningRepoForUser>;

/* -------------------------------------------------------------------------- */

function toSlot(row: {
  id: string;
  title: string;
  start: Date | null;
  minutes: number;
  flexibility: string;
  dependsOn: string[];
}): Slot {
  return {
    id: row.id,
    title: row.title,
    start: row.start,
    minutes: row.minutes,
    flexibility: row.flexibility as Slot["flexibility"],
    dependsOn: row.dependsOn,
  };
}

function snapshotTask(row: {
  title: string;
  due: Date | null;
  estimateMinutes: number;
  priority: string;
  progress: number;
  done: boolean;
}): TaskSnapshot {
  return {
    title: row.title,
    due: row.due,
    estimateMinutes: row.estimateMinutes,
    priority: row.priority,
    progress: row.progress,
    done: row.done,
  };
}
