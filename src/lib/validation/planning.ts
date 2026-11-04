/**
 * Input schemas for changing a plan: tasks, commitments and goals.
 *
 * These three models had no write path at all before this — they were seeded
 * and read, never written. So this file is not just validation for a form; it
 * is the first definition of what a legal change to someone's plan looks like,
 * and the twin's suggestion engine will be held to exactly the same schemas as
 * the screens. A model proposing a change and a user typing one go through the
 * same gate, which is the only way the two cannot drift.
 *
 * Times are full timestamps (`z.coerce.date`) because a commitment starts at
 * 14:30, not on a date. Deadlines are calendar dates and use `boundedDate`,
 * which writes UTC midnight — see the note in `shared.ts` about why a local
 * midnight silently stores the previous day.
 */

import { z } from "zod";

import { boundedDate, id, optionalText, shortText } from "@/lib/validation/shared";

export const lifeDomain = z.enum([
  "ACADEMIC",
  "PRODUCTIVITY",
  "HEALTH",
  "NUTRITION",
  "FINANCE",
  "CAREER",
  "GOALS",
  "ROUTINE",
]);

export const priority = z.enum(["CRITICAL", "HIGH", "NORMAL", "LOW"]);

export const flexibility = z.enum(["FIXED", "SHIFTABLE", "FLEXIBLE"]);

/**
 * Minutes for one block.
 *
 * The ceiling is a waking day, matching `checkDuration`. Both exist on
 * purpose: this one rejects the value at the boundary, that one re-checks it
 * where the plan is assembled, and a suggestion arriving from the model
 * crosses both.
 */
const minutes = z.coerce
  .number()
  .int("Use whole minutes.")
  .min(5, "Anything shorter than five minutes is not worth scheduling.")
  .max(16 * 60, "That is longer than a waking day — check the duration.");

/* -------------------------------------------------------------------------- */
/*                                   tasks                                    */
/* -------------------------------------------------------------------------- */

export const createTaskSchema = z.object({
  title: shortText(160),
  domain: lifeDomain.default("PRODUCTIVITY"),
  /** Optional: a task without a deadline is a perfectly ordinary task. */
  due: boundedDate.optional(),
  estimateMinutes: minutes.default(30),
  priority: priority.default("NORMAL"),
  /**
   * Why this is on the list. Optional from a form, but the twin always sets
   * it — a task the user did not create should be able to explain itself.
   */
  why: optionalText(240),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  taskId: id,
  progress: z.coerce.number().int().min(0).max(100).optional(),
});

export const rescheduleTaskSchema = z.object({
  taskId: id,
  /** Null clears the deadline rather than deleting the task. */
  due: boundedDate.nullable(),
});

export const completeTaskSchema = z.object({
  taskId: id,
  /** False reopens it. One schema, so undo is the same call with a flag. */
  done: z.boolean().default(true),
});

export const deleteTaskSchema = z.object({ taskId: id });

/* -------------------------------------------------------------------------- */
/*                                commitments                                 */
/* -------------------------------------------------------------------------- */

export const createCommitmentSchema = z.object({
  title: shortText(160),
  domain: lifeDomain.default("ROUTINE"),
  minutes,
  /** Absent means unscheduled: it exists, it is simply not on the clock. */
  start: z.coerce.date().optional(),
  flexibility: flexibility.default("FLEXIBLE"),
  priority: priority.default("NORMAL"),
  dependsOn: z.array(id).max(10).default([]),
  source: optionalText(160),
});

export const rescheduleCommitmentSchema = z.object({
  commitmentId: id,
  /** Null un-schedules it. */
  start: z.coerce.date().nullable(),
});

export const deleteCommitmentSchema = z.object({ commitmentId: id });

/**
 * A whole rebuilt day, submitted at once.
 *
 * One call rather than several, because the arrangement is only valid as a
 * whole: checked move by move, a swap is rejected at the halfway point where
 * two things briefly occupy the same slot.
 */
export const rebuildDaySchema = z.object({
  moves: z
    .array(
      z.object({
        commitmentId: id,
        start: z.coerce.date().nullable(),
      }),
    )
    .min(1, "A rebuild has to move something.")
    .max(40, "That is more moves than a day holds."),
});

/* -------------------------------------------------------------------------- */
/*                                   goals                                    */
/* -------------------------------------------------------------------------- */

export const createGoalSchema = z.object({
  title: shortText(160),
  domain: lifeDomain.default("GOALS"),
  targetDate: boundedDate.optional(),
  weeklyHours: z.coerce
    .number()
    .min(0)
    /* A goal asking for more than half a waking week is not a goal, it is the
       whole week, and the conflict detector downstream would be meaningless. */
    .max(60, "A goal cannot ask for more than 60 hours a week."),
  notes: optionalText(500),
});

export const adjustGoalSchema = z.object({
  goalId: id,
  targetDate: boundedDate.nullable().optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  weeklyHours: z.coerce.number().min(0).max(60).optional(),
});

export const deleteGoalSchema = z.object({ goalId: id });

/* -------------------------------------------------------------------------- */

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type RescheduleTaskInput = z.infer<typeof rescheduleTaskSchema>;
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;
export type CreateCommitmentInput = z.infer<typeof createCommitmentSchema>;
export type RescheduleCommitmentInput = z.infer<typeof rescheduleCommitmentSchema>;
export type RebuildDayInput = z.infer<typeof rebuildDaySchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type AdjustGoalInput = z.infer<typeof adjustGoalSchema>;
