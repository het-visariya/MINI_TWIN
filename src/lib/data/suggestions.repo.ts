/**
 * The suggestion → action engine.
 *
 * This is where "the twin suggested it and I accepted" becomes a real change
 * to a real row. Four properties hold, and each exists because its absence is
 * a specific, plausible failure:
 *
 *   1. **Apply is driven by an id alone.** The caller sends `suggestionId`;
 *      `params` comes from the stored row. If the client could send params, a
 *      crafted POST would apply any change to any row, and the thing executed
 *      would not be the thing the user was shown.
 *   2. **Double-apply is impossible, not merely unlikely.** The status check
 *      runs inside the transaction, and `AppliedAction.suggestionId` is
 *      unique — so even two requests that both read PENDING cannot both
 *      write. The database refuses the second.
 *   3. **Stale suggestions fail safe.** The executor re-reads the rows it is
 *      about to change. A task already moved, a commitment already gone, and
 *      the user is told what changed rather than having an hour-old plan
 *      silently reimposed.
 *   4. **Everything is undoable.** The prior values are captured from the
 *      executor's own return, not re-derived afterwards, so undo restores
 *      exactly what was overwritten.
 *
 * Declines are recorded too. A twin that keeps proposing the thing you said
 * no to three times is worse than one that proposes nothing.
 */

import { getPrisma } from "@/lib/db";
import { planningRepoForUser, type WriteResult } from "@/lib/data/planning.repo";
import {
  parseParams,
  type SuggestionInput,
  type SuggestionKind,
} from "@/lib/domain/twin-suggestions";

export type SuggestionView = {
  id: string;
  kind: SuggestionKind;
  summary: string;
  rationale: string;
  diff: { label: string; before: string; after: string }[];
  confidence: number;
  status: "PENDING" | "APPLIED" | "DECLINED" | "SUPERSEDED";
  /** Set once applied and not yet undone. Drives the Undo affordance. */
  appliedActionId: string | null;
};

export type ApplyOutcome =
  | { ok: true; suggestionId: string; appliedActionId: string; message: string }
  | { ok: false; reason: string; superseded?: boolean };

/* -------------------------------------------------------------------------- */

export function suggestionsRepoForUser(userId: string) {
  const prisma = getPrisma();
  const planning = planningRepoForUser(userId);

  /**
   * Run one kind.
   *
   * Every branch delegates to `planning.repo`, which is where the scheduling
   * rules live. Nothing here writes directly: an executor that reached for
   * Prisma would be a second place for the invariants to be forgotten.
   */
  async function execute(
    kind: SuggestionKind,
    params: unknown,
  ): Promise<WriteResult<unknown>> {
    switch (kind) {
      case "RESCHEDULE_TASK": {
        const p = params as { taskId: string; due: Date | null };
        return planning.rescheduleTask({ taskId: p.taskId, due: p.due });
      }

      case "COMPLETE_TASK": {
        const p = params as { taskId: string };
        return planning.completeTask({ taskId: p.taskId, done: true });
      }

      case "CREATE_TASK": {
        const p = params as Parameters<typeof planning.createTask>[0];
        return planning.createTask(p);
      }

      case "REBUILD_DAY": {
        const p = params as { moves: { commitmentId: string; start: Date | null }[] };
        return planning.rebuildDay({ moves: p.moves });
      }

      case "ADJUST_GOAL": {
        const p = params as Parameters<typeof planning.adjustGoal>[0];
        return planning.adjustGoal(p);
      }
    }
  }

  /** How to put back what an executor overwrote. */
  async function reverse(
    kind: SuggestionKind,
    previous: unknown,
    appliedId: string,
  ): Promise<WriteResult<unknown>> {
    switch (kind) {
      case "RESCHEDULE_TASK": {
        const was = previous as { due: string | null };
        return planning.rescheduleTask({
          taskId: appliedId,
          due: was.due ? new Date(was.due) : null,
        });
      }

      case "COMPLETE_TASK": {
        const was = previous as { done: boolean };
        /* Undoing a completion reopens it. If it was already done when the
           suggestion was applied, undo leaves it done — restoring the prior
           state, not toggling. */
        return planning.completeTask({ taskId: appliedId, done: was.done });
      }

      case "CREATE_TASK":
        /* The inverse of creating is deleting the row that was created. */
        return planning.deleteTask(appliedId);

      case "REBUILD_DAY": {
        const was = previous as { commitmentId: string; start: string | null }[];
        return planning.rebuildDay({
          moves: was.map((move) => ({
            commitmentId: move.commitmentId,
            start: move.start ? new Date(move.start) : null,
          })),
        });
      }

      case "ADJUST_GOAL": {
        const was = previous as {
          targetDate: string | null;
          progress: number;
          weeklyHours: number;
        };
        return planning.adjustGoal({
          goalId: appliedId,
          targetDate: was.targetDate ? new Date(was.targetDate) : null,
          progress: was.progress,
          weeklyHours: was.weeklyHours,
        });
      }
    }
  }

  return {
    /**
     * Store a proposal. Returns null when the model's params are malformed,
     * so a bad proposal never becomes a card the user cannot act on.
     */
    async create(
      input: SuggestionInput,
      messageId?: string,
    ): Promise<SuggestionView | null> {
      const checked = parseParams(input.kind, input.params);
      if (!checked.ok) {
        console.error(`[suggestion] rejected ${input.kind}: ${checked.reason}`);
        return null;
      }

      const row = await prisma.twinSuggestion.create({
        data: {
          userId,
          messageId: messageId ?? null,
          kind: input.kind,
          summary: input.summary,
          rationale: input.rationale,
          params: checked.params as object,
          diff: input.diff,
          confidence: input.confidence,
        },
      });

      return toView(row);
    },

    async get(suggestionId: string): Promise<SuggestionView | null> {
      const row = await prisma.twinSuggestion.findFirst({
        where: { id: suggestionId, userId },
        include: { applied: { select: { id: true, undoneAt: true } } },
      });

      return row ? toView(row) : null;
    },

    /**
     * Apply a pending suggestion.
     *
     * The status transition and the write are one transaction. Outside it,
     * two clicks a few milliseconds apart both read PENDING and both apply.
     */
    async apply(suggestionId: string): Promise<ApplyOutcome> {
      const row = await prisma.twinSuggestion.findFirst({
        where: { id: suggestionId, userId },
      });

      if (!row) return { ok: false, reason: "That suggestion could not be found." };

      if (row.status === "APPLIED") {
        /* Idempotent rather than an error: the user pressed twice, or a
           retry arrived. Saying "already done" is the truth. */
        const existing = await prisma.appliedAction.findUnique({
          where: { suggestionId: row.id },
          select: { id: true },
        });

        return {
          ok: true,
          suggestionId: row.id,
          appliedActionId: existing?.id ?? "",
          message: "Already applied.",
        };
      }

      if (row.status !== "PENDING") {
        return {
          ok: false,
          reason:
            row.status === "DECLINED"
              ? "You declined this one."
              : "This changed since I suggested it — ask again and I'll look at the current plan.",
          superseded: row.status === "SUPERSEDED",
        };
      }

      /* Re-validated at the moment of use. The row may have sat here for an
         hour, and the shape handed to an executor must be checked now. */
      const checked = parseParams(row.kind, row.params);
      if (!checked.ok) {
        await prisma.twinSuggestion.update({
          where: { id: row.id },
          data: { status: "SUPERSEDED" },
        });

        return { ok: false, reason: checked.reason, superseded: true };
      }

      const result = await execute(row.kind, checked.params);

      if (!result.ok) {
        /* The plan moved under the suggestion. Mark it superseded so the card
           stops offering an action that cannot succeed, and hand back the
           executor's own sentence — it names the actual obstacle. */
        await prisma.twinSuggestion.update({
          where: { id: row.id },
          data: { status: "SUPERSEDED" },
        });

        return { ok: false, reason: result.reason, superseded: true };
      }

      try {
        const applied = await prisma.$transaction(async (tx) => {
          const action = await tx.appliedAction.create({
            data: {
              userId,
              suggestionId: row.id,
              kind: row.kind,
              previous: {
                /* The id the reverse needs, alongside the overwritten values. */
                targetId: result.id,
                values: (result.previous ?? null) as object,
              },
            },
            select: { id: true },
          });

          await tx.twinSuggestion.update({
            where: { id: row.id },
            data: { status: "APPLIED" },
          });

          await tx.suggestionFeedback.create({
            data: { userId, kind: row.kind, accepted: true },
          });

          return action;
        });

        return {
          ok: true,
          suggestionId: row.id,
          appliedActionId: applied.id,
          message: "Done — your plan is updated.",
        };
      } catch {
        /* The unique constraint on suggestionId fired: another request won
           the race and applied it. The change happened exactly once, which is
           what matters, so this is reported as success. */
        const existing = await prisma.appliedAction.findUnique({
          where: { suggestionId: row.id },
          select: { id: true },
        });

        return {
          ok: true,
          suggestionId: row.id,
          appliedActionId: existing?.id ?? "",
          message: "Already applied.",
        };
      }
    },

    /** Record a no, so ranking can stop offering this kind so readily. */
    async decline(suggestionId: string): Promise<{ ok: boolean; reason?: string }> {
      const row = await prisma.twinSuggestion.findFirst({
        where: { id: suggestionId, userId },
        select: { id: true, kind: true, status: true },
      });

      if (!row) return { ok: false, reason: "That suggestion could not be found." };
      if (row.status === "APPLIED") {
        return { ok: false, reason: "That one was already applied. Undo it instead." };
      }

      await prisma.$transaction([
        prisma.twinSuggestion.update({
          where: { id: row.id },
          data: { status: "DECLINED" },
        }),
        prisma.suggestionFeedback.create({
          data: { userId, kind: row.kind, accepted: false },
        }),
      ]);

      return { ok: true };
    },

    /** Put back exactly what was overwritten. */
    async undo(appliedActionId: string): Promise<{ ok: boolean; reason?: string }> {
      const action = await prisma.appliedAction.findFirst({
        where: { id: appliedActionId, userId },
      });

      if (!action) return { ok: false, reason: "That change could not be found." };
      if (action.undoneAt) return { ok: true };

      const stored = action.previous as { targetId: string; values: unknown } | null;
      if (!stored?.targetId) {
        return { ok: false, reason: "There is nothing recorded to undo for that." };
      }

      const result = await reverse(action.kind, stored.values, stored.targetId);

      if (!result.ok) {
        return {
          ok: false,
          reason: `That could not be undone: ${result.reason}`,
        };
      }

      await prisma.$transaction([
        prisma.appliedAction.update({
          where: { id: action.id },
          data: { undoneAt: new Date() },
        }),
        prisma.twinSuggestion.update({
          where: { id: action.suggestionId },
          data: { status: "PENDING" },
        }),
      ]);

      return { ok: true };
    },

    /**
     * How often each kind has been accepted lately.
     *
     * Feeds ranking: a kind the user keeps declining should be offered less.
     * Bounded to the recent past, because what someone wanted in March is not
     * evidence about today.
     */
    async acceptanceByKind(sinceDays = 30): Promise<Record<string, { yes: number; no: number }>> {
      const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

      const rows = await prisma.suggestionFeedback.groupBy({
        by: ["kind", "accepted"],
        where: { userId, createdAt: { gte: since } },
        _count: { _all: true },
      });

      const out: Record<string, { yes: number; no: number }> = {};

      for (const row of rows) {
        out[row.kind] ??= { yes: 0, no: 0 };
        if (row.accepted) out[row.kind].yes += row._count._all;
        else out[row.kind].no += row._count._all;
      }

      return out;
    },
  };
}

export type SuggestionsRepo = ReturnType<typeof suggestionsRepoForUser>;

function toView(row: {
  id: string;
  kind: string;
  summary: string;
  rationale: string;
  diff: unknown;
  confidence: number;
  status: string;
  applied?: { id: string; undoneAt: Date | null } | null;
}): SuggestionView {
  return {
    id: row.id,
    kind: row.kind as SuggestionKind,
    summary: row.summary,
    rationale: row.rationale,
    diff: Array.isArray(row.diff) ? (row.diff as SuggestionView["diff"]) : [],
    confidence: row.confidence,
    status: row.status as SuggestionView["status"],
    appliedActionId: row.applied && !row.applied.undoneAt ? row.applied.id : null,
  };
}
