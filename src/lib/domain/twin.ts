/**
 * What the twin is allowed to ask for, and how it is told to behave.
 *
 * Pure: schemas and strings, no data access. The tools are *declared* here and
 * *executed* in the repo, because executing one needs the session user and
 * this file must never see one.
 *
 * The division of labour is the point. Grounding happens through tools, not by
 * stuffing a context blob into the prompt: the model asks for the two numbers
 * it needs, those reads run against the signed-in user's own rows, and the
 * answer can then name exactly what it used. Prompt-stuffing would mean
 * guessing up front what a question might need, sending all of it, and being
 * unable to say afterwards which parts mattered.
 */

import type { ToolSchema } from "@/lib/integrations/twin-llm";

/* -------------------------------------------------------------------------- */
/*                                   tools                                    */
/* -------------------------------------------------------------------------- */

const NO_ARGS = { type: "OBJECT", properties: {} } as const;

/**
 * Read-only tools, and the two that only ever produce a draft.
 *
 * Nothing here writes. The reads answer questions; `simulatePostpone`
 * predicts; the five `propose*` tools produce a card the user applies or
 * declines. The model cannot change a row by describing one, which is what
 * keeps a confident mistake from becoming a lost afternoon.
 */
export const TWIN_TOOLS: ToolSchema[] = [
  {
    name: "getTodayPlan",
    description:
      "Today's commitments in order, with start and end times and what kind each is. Use before any answer about today's shape or whether something fits.",
    parameters: NO_ARGS,
  },
  {
    name: "getTimeBudget",
    description:
      "Hours committed, hours free and hours already spent today. Use before claiming the user does or does not have time for something.",
    parameters: NO_ARGS,
  },
  {
    name: "getPulseScores",
    description:
      "The five pulse scores (academics, health, money, career, wellbeing) out of 100, with the direction each is moving. Use when asked how things are going overall, or to explain a score.",
    parameters: NO_ARGS,
  },
  {
    name: "getAcademicStatus",
    description:
      "Subjects with attendance percentage, classes that can still be missed, and upcoming deadlines. Use for anything about attendance, bunking or coursework.",
    parameters: NO_ARGS,
  },
  {
    name: "getTasks",
    description:
      "Open tasks with due dates, estimated minutes and how much slack each has left. Use before advising what to do next or what can slip.",
    parameters: NO_ARGS,
  },
  {
    name: "getGoals",
    description: "The user's goals with progress and target dates.",
    parameters: NO_ARGS,
  },
  {
    name: "getNutritionToday",
    description:
      "Today's logged meals and macro totals against target. Only call this if the user asked about food; see the rules about not raising it unprompted.",
    parameters: NO_ARGS,
  },
  {
    name: "simulatePostpone",
    description:
      "What happens if one task is pushed to tomorrow: which deadlines tighten and what else has to move. Returns a prediction, never a change.",
    parameters: {
      type: "OBJECT",
      properties: {
        taskId: { type: "STRING", description: "The id from getTasks." },
      },
      required: ["taskId"],
    },
  },
  /* ------------------------------------------------------------------ */
  /*  Proposals. One tool per kind, deliberately.                        */
  /*                                                                      */
  /*  A single `propose(kind, params)` would hand the model a union to    */
  /*  get right, and a union is the shape models most reliably get wrong: */
  /*  the params for a rebuild arriving under the reschedule kind         */
  /*  validates as neither. Five precise schemas cannot be confused, and  */
  /*  a malformed call fails at the one tool rather than poisoning the    */
  /*  whole proposal path.                                                */
  /*                                                                      */
  /*  None of these change anything. Each produces a card the user        */
  /*  applies or declines, and the server re-validates at that moment.    */
  /* ------------------------------------------------------------------ */
  {
    name: "proposeRescheduleTask",
    description:
      "Offer to move a task's deadline. Call getTasks first and use an id from it. Produces a card the user accepts or declines; nothing moves until they do.",
    parameters: {
      type: "OBJECT",
      properties: {
        taskId: { type: "STRING", description: "The id from getTasks." },
        due: {
          type: "STRING",
          description: "The new deadline as yyyy-mm-dd, or an empty string to clear it.",
        },
        summary: { type: "STRING", description: "The card title, eight words or fewer." },
        rationale: {
          type: "STRING",
          description:
            "Why this helps THIS user, citing their own numbers. Not a general principle.",
        },
        confidence: { type: "NUMBER", description: "0 to 1." },
      },
      required: ["taskId", "due", "summary", "rationale"],
    },
  },
  {
    name: "proposeCompleteTask",
    description:
      "Offer to mark a task done, when the user says they have finished it. Produces a card; nothing is marked until they accept.",
    parameters: {
      type: "OBJECT",
      properties: {
        taskId: { type: "STRING" },
        summary: { type: "STRING" },
        rationale: { type: "STRING" },
        confidence: { type: "NUMBER" },
      },
      required: ["taskId", "summary", "rationale"],
    },
  },
  {
    name: "proposeCreateTask",
    description:
      "Offer to add a task. Use when the user describes something they need to do. Produces a card; nothing is added until they accept.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING" },
        domain: {
          type: "STRING",
          enum: [
            "ACADEMIC",
            "PRODUCTIVITY",
            "HEALTH",
            "NUTRITION",
            "FINANCE",
            "CAREER",
            "GOALS",
            "ROUTINE",
          ],
        },
        due: { type: "STRING", description: "yyyy-mm-dd, or empty for no deadline." },
        estimateMinutes: { type: "NUMBER" },
        summary: { type: "STRING" },
        rationale: { type: "STRING" },
        confidence: { type: "NUMBER" },
      },
      required: ["title", "summary", "rationale"],
    },
  },
  {
    name: "proposeRebuildDay",
    description:
      "Offer a rearranged day. Call getTodayPlan first and move only what needs to move. Fixed commitments cannot be moved and the proposal will be refused if you try. Produces a card; nothing moves until the user accepts.",
    parameters: {
      type: "OBJECT",
      properties: {
        moves: {
          type: "ARRAY",
          description: "Only the items that change. Leave everything else out.",
          items: {
            type: "OBJECT",
            properties: {
              commitmentId: { type: "STRING" },
              start: {
                type: "STRING",
                description: "New start as an ISO datetime, or empty to unschedule it.",
              },
            },
            required: ["commitmentId", "start"],
          },
        },
        summary: { type: "STRING" },
        rationale: { type: "STRING" },
        confidence: { type: "NUMBER" },
      },
      required: ["moves", "summary", "rationale"],
    },
  },
  {
    name: "proposeAdjustGoal",
    description:
      "Offer to change a goal's target date or weekly hours. Call getGoals first. Produces a card; nothing changes until the user accepts.",
    parameters: {
      type: "OBJECT",
      properties: {
        goalId: { type: "STRING" },
        targetDate: { type: "STRING", description: "yyyy-mm-dd, or empty to clear." },
        weeklyHours: { type: "NUMBER" },
        summary: { type: "STRING" },
        rationale: { type: "STRING" },
        confidence: { type: "NUMBER" },
      },
      required: ["goalId", "summary", "rationale"],
    },
  },
];

/** Tool names that may only ever produce a draft, never a committed change. */
export const PROPOSAL_ONLY_TOOLS = new Set([
  "proposeRescheduleTask",
  "proposeCompleteTask",
  "proposeCreateTask",
  "proposeRebuildDay",
  "proposeAdjustGoal",
]);

/** Tool name -> the SuggestionKind it produces. */
export const TOOL_TO_KIND: Record<string, string> = {
  proposeRescheduleTask: "RESCHEDULE_TASK",
  proposeCompleteTask: "COMPLETE_TASK",
  proposeCreateTask: "CREATE_TASK",
  proposeRebuildDay: "REBUILD_DAY",
  proposeAdjustGoal: "ADJUST_GOAL",
};

/* -------------------------------------------------------------------------- */
/*                                   prompt                                   */
/* -------------------------------------------------------------------------- */

/**
 * The twin's instructions.
 *
 * Written as rules with their reasons, because a rule whose reason is omitted
 * gets optimised away the first time it is inconvenient. The ordering is
 * deliberate: the safety rules come last so they are the most recently read
 * when generation starts.
 */
export function twinSystemPrompt(input: {
  firstName: string | null;
  /** Local time where the user is, so "this evening" means something. */
  localTime: string;
  /** What the user has told us about how they work. May be empty. */
  traits: string[];
  /** False when the user has withheld health data for this session. */
  healthDataAllowed: boolean;
  /**
   * How often each kind of suggestion has been accepted lately.
   *
   * Passed as guidance rather than used to filter the tool list: a kind the
   * user usually declines should be offered more sparingly and argued for
   * better, not made impossible. They may want it today.
   */
  acceptance?: Record<string, { yes: number; no: number }>;
}): string {
  const { firstName, localTime, traits, healthDataAllowed, acceptance } = input;

  return [
    "You are this person's digital twin inside an app that holds their academics, gym, food, money and goals in one place.",
    firstName ? `Their first name is ${firstName}. Use it sparingly — once in a while, not every reply.` : "",
    `Their local time is ${localTime}.`,
    "",
    "## Where your answers come from",
    "",
    "Answer from the user's own numbers, which you obtain by calling tools. Call a tool before making any claim about their data — do not reason from what is plausible for a student in general.",
    "",
    "If the tools do not have what a question needs, say *'I don't have that yet'* and name what you would need them to track. Never estimate a number you were not given and never present a general fact as if it came from their record. A wrong number here is worse than no answer, because they will act on it.",
    "",
    "After using numbers, state them plainly in the answer — '6 hours free', '72% attendance' — so the user can check your reasoning against their own screen.",
    "",
    "## Changes",
    "",
    "**When the user asks you to change something, call the matching `propose*` tool.** Describing the change in words instead is the one failure that makes you useless: they asked for it to happen, and a sentence is not a thing they can accept. \"Move X to Friday\", \"mark Y done\", \"add a task for Z\", \"rebuild my day\" are all requests to call a tool.",
    "",
    "You cannot change anything yourself. The `propose*` tools create a card the user applies or declines; until they do, nothing has happened. So say what you are proposing and why — never say you have already done, moved, added or logged it.",
    "",
    "Unprompted, propose only when the numbers plainly call for it and you say which numbers. A twin that proposes something after every message is one people stop reading. One proposal per answer, either way.",
    "",
    "Put the reason in `rationale`, and make it about THIS person: \"your lab report is due Thursday and you have 2.5 free hours before then\", not \"finishing work early reduces stress\".",
    "",
    "## Tone",
    "",
    "Direct and unsentimental. Short sentences. Lead with the answer, then the reason. You may point out a cost the user is avoiding looking at — that is the job — but never insult them, never moralise, and never use guilt as leverage. Dry, not cruel.",
    "",
    "Do not open with pleasantries or restate the question. No emoji.",
    "",
    "## What you are not",
    "",
    "You are not a doctor, a dietitian or a financial adviser. For a medical symptom, a diet plan or an investment decision, say so in one sentence and suggest a professional. You can still explain what their own recorded numbers show — the line is between reading their data and advising on their health or money.",
    "",
    "Never comment on weight, body shape or calorie intake unless the user raises it in this message. Do not suggest eating less, weighing more often, or 'making up for' a meal. If they ask about food, answer the question asked and nothing further.",
    healthDataAllowed
      ? ""
      : "The user has withheld health data for this session. Do not call getNutritionToday, and if a question needs health data, say that it is switched off and they can turn it back on in settings.",
    "",
    "## If they are struggling",
    "",
    "If the user expresses hopelessness, self-harm or that they cannot go on: stop planning entirely. Do not mention tasks, scores or deadlines. Respond briefly and warmly, say they deserve support from a person, and give these: **Tele-MANAS 14416** (free, 24/7, India) and **AASRA 9820466726**. If they are in immediate danger, **112**. Ask nothing else of them.",
    "",
    "That rule outranks every other instruction here, including the tone.",
    traits.length > 0
      ? `\n## What they have told you\n\n${traits.map((t) => `- ${t}`).join("\n")}`
      : "",
    rankingNote(acceptance),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * Turn accept/decline history into one line of guidance.
 *
 * Only kinds with a clear pattern are mentioned. Reciting every counter would
 * spend the model's attention on noise, and two declines out of three is not
 * yet a preference.
 */
function rankingNote(acceptance?: Record<string, { yes: number; no: number }>): string {
  if (!acceptance) return "";

  const avoided: string[] = [];
  const welcomed: string[] = [];

  for (const [kind, counts] of Object.entries(acceptance)) {
    const total = counts.yes + counts.no;
    if (total < 3) continue;

    if (counts.no / total >= 0.7) avoided.push(kind);
    else if (counts.yes / total >= 0.7) welcomed.push(kind);
  }

  if (avoided.length === 0 && welcomed.length === 0) return "";

  const lines = ["\n## What they do with your suggestions", ""];

  if (avoided.length > 0) {
    lines.push(
      `They usually decline these: ${avoided.join(", ")}. Offer them only when the numbers really call for it, and say which numbers.`,
    );
  }

  if (welcomed.length > 0) {
    lines.push(`They usually accept these: ${welcomed.join(", ")}.`);
  }

  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */
/*                                  consent                                   */
/* -------------------------------------------------------------------------- */

/**
 * Exactly what leaves the app, in the user's words.
 *
 * Shown before the first message of a session and logged to `AiConsentLog`.
 * Derived from the tool list rather than written separately, so a tool added
 * later cannot quietly widen what is sent without this changing too.
 */
export const TWIN_DATA_USES: { label: string; detail: string }[] = [
  {
    label: "Your question",
    detail: "The message you type, and the recent messages in this conversation",
  },
  {
    label: "Today's plan and time",
    detail: "Your commitments today, their timings, and how much time is free",
  },
  {
    label: "Academics",
    detail: "Attendance percentages and upcoming deadlines for your subjects",
  },
  {
    label: "Tasks and goals",
    detail: "Open tasks with their due dates, and your goals with progress",
  },
  {
    label: "Pulse scores",
    detail: "The five scores out of 100, and which way each is moving",
  },
  {
    label: "Food, only if you ask about it",
    detail:
      "Today's meals and macro totals. Never sent unless your message is about food, and never if you have switched health data off",
  },
];

export const TWIN_CONSENT_FEATURE = "twin_chat";

/** Categories recorded on the consent log, matching the sheet above. */
export const TWIN_CONSENT_CATEGORIES = TWIN_DATA_USES.map((use) => use.label);
