/**
 * Running the twin's tools, and remembering the conversation.
 *
 * Every tool here is a read against one user's rows, reached through
 * `forUser(userId)`. The model never receives a userId and has no way to name
 * one: it asks for "today's plan", and which plan that is was decided before
 * this module was called. That is the whole access-control story, and it is
 * why these cannot be plain functions taking a userId from the request.
 *
 * The three proposal tools return a *description* of a change. Nothing in this
 * file writes to a domain table. A twin that can act on a confident mistake is
 * a twin that can lose someone an afternoon, so the only writes are the
 * conversation itself and the consent log.
 */

import { forUser } from "@/lib/data/repo";
import { getPrisma } from "@/lib/db";
import { isoDate } from "@/lib/domain/calc/health";
import { PROPOSAL_ONLY_TOOLS, TOOL_TO_KIND } from "@/lib/domain/twin";
import type { SuggestionInput, SuggestionKind } from "@/lib/domain/twin-suggestions";
import type { ToolCall } from "@/lib/integrations/twin-llm";

/** What the UI shows as "numbers used" chips under an answer. */
export type UsedNumber = { label: string; value: string };

export type ToolRun = {
  /** Handed back to the model. */
  result: unknown;
  /** Shown to the user. Empty for a tool that produced no figure. */
  used: UsedNumber[];
  /**
   * Set by the `propose*` tools. A typed suggestion, not prose: the route
   * stores it and the stored row is what Apply later executes, so what the
   * user is shown and what runs are the same object.
   */
  suggestion?: SuggestionInput;
};

/**
 * Execute one tool call for one user.
 *
 * Returns a `ToolRun` rather than throwing on an unknown name: a model that
 * invents a tool should be told so and allowed to recover, not have the
 * answer aborted underneath it.
 */
export async function runTwinTool(
  userId: string,
  call: ToolCall,
  options: { healthDataAllowed: boolean },
): Promise<ToolRun> {
  const repo = forUser(userId);

  switch (call.name) {
    case "getTodayPlan": {
      const snapshot = await repo.getTwinSnapshot();
      const today = snapshot.today.map((item) => ({
        title: item.title,
        start: item.start ?? null,
        minutes: item.minutes,
        flexibility: item.flexibility,
        priority: item.priority,
      }));

      return {
        result: { commitments: today, oneThing: snapshot.oneThing },
        used: [
          { label: "Today", value: `${today.length} commitment${today.length === 1 ? "" : "s"}` },
        ],
      };
    }

    case "getTimeBudget": {
      const snapshot = await repo.getTwinSnapshot();
      const budget = snapshot.timeBudget;

      return {
        result: budget,
        used: [
          { label: "Available today", value: `${round1(budget.availableHours)}h` },
          { label: "Planned", value: `${round1(budget.plannedHours)}h` },
        ],
      };
    }

    case "getPulseScores": {
      const snapshot = await repo.getTwinSnapshot();

      return {
        result: {
          pulse: snapshot.pulse.map((score) => ({
            label: score.label,
            value: score.value,
            trend: score.trend,
          })),
          momentum: snapshot.momentum,
        },
        used: snapshot.pulse.map((score) => ({
          label: score.label,
          value: `${score.value}/100`,
        })),
      };
    }

    case "getAcademicStatus": {
      const academic = await repo.getAcademic();
      const subjects = academic.subjects.map((subject) => ({
        name: subject.name,
        attendancePercent: subject.attendance.held
          ? Math.round((subject.attendance.attended / subject.attendance.held) * 100)
          : null,
        required: subject.attendance.required,
        /* Marks are absent until the user records them, and are never
           estimated on their behalf -- so null here means "not recorded",
           which the model must not read as zero. */
        internalMarks: subject.grade
          ? `${subject.grade.internal}/${subject.grade.internalMax}`
          : null,
      }));

      return {
        result: { subjects, risk: academic.risk },
        used: subjects
          .filter((subject) => subject.attendancePercent !== null)
          .map((subject) => ({
            label: subject.name,
            value: `${subject.attendancePercent}% attendance`,
          })),
      };
    }

    case "getTasks": {
      const productivity = await repo.getProductivity();
      const open = productivity.tasks.filter((task) => !task.done);

      return {
        result: {
          tasks: open.map((task) => ({
            id: task.id,
            title: task.title,
            due: task.due ?? null,
            estimateMinutes: task.estimateMinutes,
            priority: task.priority,
            progress: task.progress,
            why: task.why,
          })),
        },
        used: [{ label: "Open tasks", value: String(open.length) }],
      };
    }

    case "getGoals": {
      const planning = await repo.getPlanning();

      return {
        result: {
          goals: planning.goals.map((goal) => ({
            title: goal.title,
            domain: goal.domain,
            progress: goal.progress,
            due: goal.due ?? null,
          })),
        },
        used: planning.goals.map((goal) => ({
          label: goal.title,
          value: `${goal.progress}%`,
        })),
      };
    }

    case "getNutritionToday": {
      /* The session toggle is enforced here, not only in the prompt. An
         instruction can be talked around; a missing branch cannot. */
      if (!options.healthDataAllowed) {
        return {
          result: {
            unavailable:
              "The user has switched health data off for this session. Tell them that, and that they can turn it back on in settings.",
          },
          used: [],
        };
      }

      const { getNutritionRepo } = await import("@/lib/data/repo");
      const nutrition = await (await getNutritionRepo()).getNutrition();

      return {
        result: {
          totals: nutrition.totals,
          targets: nutrition.targets,
          meals: nutrition.today.map((meal) => ({
            mealType: meal.mealType,
            items: meal.items.map((item) => item.label),
            kcal: meal.totals.kcal,
          })),
          note: "Every figure here is an estimate, and some were read from photographs.",
        },
        used: [
          { label: "Today", value: `${nutrition.totals.kcal} kcal` },
          { label: "Protein", value: `${nutrition.totals.proteinG} g` },
        ],
      };
    }

    /* ---------------------------------------------------------------- */
    /*                           proposals only                          */
    /* ---------------------------------------------------------------- */

    case "simulatePostpone": {
      /* A prediction, not a proposal. Kept separate so the twin can answer
         "what would happen if" without putting a card on screen — asking is
         not the same as wanting to change something. */
      const taskId = String(call.args.taskId ?? "");
      const productivity = await repo.getProductivity();
      const task = productivity.tasks.find((row) => row.id === taskId);

      if (!task) {
        return {
          result: { error: "No task with that id. Call getTasks first." },
          used: [],
        };
      }

      const planning = await repo.getPlanning();

      return {
        result: {
          nature: "prediction",
          task: { title: task.title, due: task.due ?? null, estimateMinutes: task.estimateMinutes },
          timeBudget: planning.timeBudget,
          conflicts: planning.conflicts,
        },
        used: [
          { label: task.title, value: `${task.estimateMinutes} min` },
          { label: "Due", value: task.due ? isoDate(new Date(task.due)) : "no date" },
        ],
      };
    }

    /* ------------------------------------------------------------------ */
    /*  Proposals. Each builds a typed suggestion and changes nothing.     */
    /* ------------------------------------------------------------------ */

    case "proposeRescheduleTask":
    case "proposeCompleteTask":
    case "proposeCreateTask":
    case "proposeRebuildDay":
    case "proposeAdjustGoal": {
      const kind = TOOL_TO_KIND[call.name] as SuggestionKind;

      const suggestion: SuggestionInput = {
        kind,
        summary: String(call.args.summary ?? "A change to your plan").slice(0, 160),
        rationale: String(call.args.rationale ?? "").slice(0, 400),
        confidence: clamp01(Number(call.args.confidence ?? 0.5)),
        diff: [],
        params: paramsFromArgs(call.name, call.args),
      };

      return {
        result: {
          nature: "proposal",
          /* The model is told plainly that nothing has happened, so it does
             not then describe the change in the past tense. */
          status: "shown to the user as a card; not applied",
          kind,
        },
        used: [],
        suggestion,
      };
    }

    default:
      return {
        result: {
          error: `No tool named ${call.name}. Use only the tools you were given.`,
        },
        used: [],
      };
  }
}

/** True when a tool name is one that may only ever produce a draft. */
export function isProposalTool(name: string): boolean {
  return PROPOSAL_ONLY_TOOLS.has(name);
}

/* -------------------------------------------------------------------------- */
/*                               conversation                                 */
/* -------------------------------------------------------------------------- */

export type StoredTurn = { author: "USER" | "TWIN"; text: string };

/** The recent exchange, oldest first, for context on the next question. */
export async function recentTurns(userId: string, threadId: string, take = 12) {
  const rows = await getPrisma().twinMessage.findMany({
    where: { userId, threadId },
    orderBy: { createdAt: "desc" },
    take,
    select: { author: true, text: true },
  });

  return rows.reverse();
}

export async function saveTurn(
  userId: string,
  threadId: string,
  turn: {
    author: "USER" | "TWIN";
    text: string;
    sources?: UsedNumber[];
    proposal?: unknown;
    suggestions?: string[];
  },
): Promise<string> {
  const row = await getPrisma().twinMessage.create({
    data: {
      userId,
      threadId,
      author: turn.author,
      text: turn.text,
      sources: turn.sources && turn.sources.length > 0 ? turn.sources : undefined,
      proposal: (turn.proposal as object | undefined) ?? undefined,
      suggestions: turn.suggestions ?? [],
    },
    select: { id: true },
  });

  return row.id;
}

/**
 * Record that the user agreed to send personal context.
 *
 * Stores the categories and a summary, never the payload. The point of the log
 * is to be able to answer "what has been sent on my behalf", and keeping the
 * messages themselves here would make the log its own privacy problem.
 */
export async function logConsent(
  userId: string,
  input: { feature: string; categories: string[]; summary: string },
): Promise<void> {
  await getPrisma().aiConsentLog.create({
    data: {
      userId,
      feature: input.feature,
      categories: input.categories,
      summary: input.summary,
    },
  });
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

/** Empty string means "clear it"; the model cannot send null through JSON. */
function orNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length === 0 ? null : text;
}

/**
 * Pull executor params out of the tool arguments.
 *
 * Shape only — no validation. The zod schema in `twin-suggestions` is the
 * gate, and it runs twice: here on the way into storage, and again when the
 * user presses Apply. Doing it twice is what caught the JSON round-trip bug
 * where a stored Date no longer matched the schema that wrote it.
 */
function paramsFromArgs(tool: string, args: Record<string, unknown>): unknown {
  switch (tool) {
    case "proposeRescheduleTask":
      return { taskId: args.taskId, due: orNull(args.due) };

    case "proposeCompleteTask":
      return { taskId: args.taskId };

    case "proposeCreateTask":
      return {
        title: args.title,
        domain: args.domain ?? "PRODUCTIVITY",
        ...(orNull(args.due) ? { due: orNull(args.due) } : {}),
        estimateMinutes: args.estimateMinutes ?? 30,
      };

    case "proposeRebuildDay":
      return {
        moves: Array.isArray(args.moves)
          ? args.moves.map((move) => {
              const entry = move as Record<string, unknown>;
              return { commitmentId: entry.commitmentId, start: orNull(entry.start) };
            })
          : [],
      };

    case "proposeAdjustGoal":
      return {
        goalId: args.goalId,
        ...(args.targetDate !== undefined ? { targetDate: orNull(args.targetDate) } : {}),
        ...(args.weeklyHours !== undefined ? { weeklyHours: args.weeklyHours } : {}),
      };

    default:
      return {};
  }
}
