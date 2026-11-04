/**
 * What a suggestion is allowed to ask for.
 *
 * One zod schema per kind, and the schema is the contract — not the prose the
 * model wrote alongside it. The model proposes `params`; this file decides
 * whether those params are even a sentence in the language of changes, and
 * the executor decides whether the change is legal against the user's actual
 * rows.
 *
 * Two separations are load-bearing:
 *
 *   - **`summary`/`rationale`/`diff` are display; `params` is execution.**
 *     Nothing in the prose reaches the database. A model that writes a
 *     convincing paragraph about deleting everything still has to produce
 *     params that pass one of the schemas below, and those schemas cannot
 *     express "delete everything".
 *   - **`params` is validated twice**: once when the suggestion is created,
 *     so a malformed proposal never reaches the card, and again at apply
 *     time, because the row may have been sitting there for an hour and the
 *     shape it is handed to an executor must be checked at the moment it is
 *     used, not the moment it was written.
 */

import { z } from "zod";

import { id, toCalendarDate } from "@/lib/validation/shared";
import { lifeDomain, priority } from "@/lib/validation/planning";

/**
 * A calendar date that survives a round trip through JSONB.
 *
 * `boundedDate` accepts only `yyyy-mm-dd` and transforms it to a Date. That
 * is right for a form, and wrong here: params are validated once on the way
 * in, stored as JSON — where the Date becomes a full ISO string — and
 * validated again on the way out. The second pass saw
 * "2026-11-25T00:00:00.000Z", rejected it as not `yyyy-mm-dd`, and every
 * suggestion carrying a date failed at the moment the user accepted it.
 *
 * So this accepts the short form, the ISO form, and an actual Date, and
 * normalises all three to the UTC midnight the `@db.Date` columns store.
 */
const calendarDate = z
  .union([z.string(), z.date()])
  .transform((value, ctx) => {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        ctx.addIssue({ code: "custom", message: "That is not a real date." });
        return z.NEVER;
      }

      return new Date(
        Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
      );
    }

    const short = value.slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(short)) {
      ctx.addIssue({ code: "custom", message: "Use a date in the form yyyy-mm-dd." });
      return z.NEVER;
    }

    const parsed = toCalendarDate(short);

    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: "custom", message: "That is not a real date." });
      return z.NEVER;
    }

    return parsed;
  });

export const SUGGESTION_KINDS = [
  "RESCHEDULE_TASK",
  "COMPLETE_TASK",
  "CREATE_TASK",
  "REBUILD_DAY",
  "ADJUST_GOAL",
] as const;

export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

/* -------------------------------------------------------------------------- */
/*                              per-kind params                               */
/* -------------------------------------------------------------------------- */

export const rescheduleTaskParams = z.object({
  taskId: id,
  /** Null clears the deadline. The task is not deleted. */
  due: calendarDate.nullable(),
});

export const completeTaskParams = z.object({
  taskId: id,
});

export const createTaskParams = z.object({
  title: z.string().trim().min(1).max(160),
  domain: lifeDomain.default("PRODUCTIVITY"),
  due: calendarDate.optional(),
  estimateMinutes: z.coerce.number().int().min(5).max(16 * 60).default(30),
  priority: priority.default("NORMAL"),
});

export const rebuildDayParams = z.object({
  moves: z
    .array(z.object({ commitmentId: id, start: z.coerce.date().nullable() }))
    .min(1)
    /* A day holds tens of items. A model asking to move hundreds has
       misunderstood the request, and applying it would be unreviewable. */
    .max(40),
});

export const adjustGoalParams = z.object({
  goalId: id,
  targetDate: calendarDate.nullable().optional(),
  weeklyHours: z.coerce.number().min(0).max(60).optional(),
});

/** The schema registry. Adding a kind without a schema is a type error. */
export const SUGGESTION_PARAMS = {
  RESCHEDULE_TASK: rescheduleTaskParams,
  COMPLETE_TASK: completeTaskParams,
  CREATE_TASK: createTaskParams,
  REBUILD_DAY: rebuildDayParams,
  ADJUST_GOAL: adjustGoalParams,
} as const satisfies Record<SuggestionKind, z.ZodTypeAny>;

export type ParamsFor<K extends SuggestionKind> = z.infer<(typeof SUGGESTION_PARAMS)[K]>;

/**
 * Validate params for a kind.
 *
 * Returns a result rather than throwing, because the common caller is a model
 * reply: a badly shaped proposal is an everyday occurrence to be handled, not
 * an exceptional condition.
 */
export function parseParams(
  kind: SuggestionKind,
  params: unknown,
): { ok: true; params: unknown } | { ok: false; reason: string } {
  const schema = SUGGESTION_PARAMS[kind];
  const parsed = schema.safeParse(params);

  if (!parsed.success) {
    return {
      ok: false,
      reason: parsed.error.issues[0]?.message ?? "That suggestion was not well formed.",
    };
  }

  return { ok: true, params: parsed.data };
}

/* -------------------------------------------------------------------------- */
/*                               the card shape                               */
/* -------------------------------------------------------------------------- */

/** One before/after line on the card. Display only; never executed. */
export const suggestionDiff = z.object({
  label: z.string().trim().min(1).max(80),
  before: z.string().trim().max(160),
  after: z.string().trim().max(160),
});

export const suggestionSchema = z.object({
  kind: z.enum(SUGGESTION_KINDS),
  summary: z.string().trim().min(1).max(160),
  /** Why this helps *this* user. The model is told to make it specific. */
  rationale: z.string().trim().min(1).max(400),
  diff: z.array(suggestionDiff).max(12).default([]),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
  params: z.unknown(),
});

export type SuggestionInput = z.infer<typeof suggestionSchema>;

/** Wording for the card's verb, so the UI never has to switch on the kind. */
export const SUGGESTION_VERB: Record<SuggestionKind, string> = {
  RESCHEDULE_TASK: "Move it",
  COMPLETE_TASK: "Mark it done",
  CREATE_TASK: "Add it",
  REBUILD_DAY: "Rebuild today",
  ADJUST_GOAL: "Adjust the goal",
};
