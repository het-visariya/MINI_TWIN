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
import { PROPOSAL_ONLY_TOOLS } from "@/lib/domain/twin";
import type { ToolCall } from "@/lib/integrations/twin-llm";

/** What the UI shows as "numbers used" chips under an answer. */
export type UsedNumber = { label: string; value: string };

export type ToolRun = {
  /** Handed back to the model. */
  result: unknown;
  /** Shown to the user. Empty for a tool that produced no figure. */
  used: UsedNumber[];
  /** Set by the proposal tools; becomes an Apply / Edit / Dismiss card. */
  proposal?: {
    summary: string;
    changes: { label: string; detail: string }[];
  };
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
      const taskId = String(call.args.taskId ?? "");
      const productivity = await repo.getProductivity();
      const task = productivity.tasks.find((row) => row.id === taskId);

      if (!task) {
        return {
          result: { error: "No task with that id. Call getTasks first and use an id from it." },
          used: [],
        };
      }

      const planning = await repo.getPlanning();

      return {
        result: {
          task: { title: task.title, due: task.due ?? null, estimateMinutes: task.estimateMinutes },
          /* The model is told plainly that this is a prediction, so it does
             not report it as something that happened. */
          nature: "prediction",
          timeBudget: planning.timeBudget,
          conflicts: planning.conflicts,
        },
        used: [
          { label: task.title, value: `${task.estimateMinutes} min` },
          { label: "Due", value: task.due ? isoDate(new Date(task.due)) : "no date" },
        ],
        proposal: {
          summary: `Push "${task.title}" to tomorrow`,
          changes: [
            {
              label: task.title,
              detail: `${task.estimateMinutes} minutes moves to tomorrow${
                task.due ? `, due ${isoDate(new Date(task.due))}` : ""
              }`,
            },
          ],
        },
      };
    }

    case "proposeDayRebuild": {
      const constraints = String(call.args.constraints ?? "").slice(0, 300);
      const snapshot = await repo.getTwinSnapshot();

      return {
        result: {
          nature: "proposal",
          constraints,
          today: snapshot.today.map((item) => ({
            title: item.title,
            start: item.start ?? null,
            minutes: item.minutes,
            flexibility: item.flexibility,
          })),
          timeBudget: snapshot.timeBudget,
          instruction:
            "Describe the rearrangement you suggest. It is shown to the user as a card they apply or dismiss; it has not happened.",
        },
        used: [
          { label: "Available today", value: `${round1(snapshot.timeBudget.availableHours)}h` },
        ],
        proposal: {
          summary: "Rebuild the rest of today",
          changes: [{ label: "Constraints", detail: constraints || "none given" }],
        },
      };
    }

    case "logEntry": {
      const type = String(call.args.type ?? "task");
      const payload = String(call.args.payload ?? "").slice(0, 300);

      return {
        result: {
          nature: "draft",
          type,
          payload,
          instruction: "This is a draft. Tell the user what you have drafted and that they must confirm it.",
        },
        used: [],
        proposal: {
          summary: `Draft ${type}: ${payload}`,
          changes: [{ label: type, detail: payload }],
        },
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
