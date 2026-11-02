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
 * Nothing here writes. `simulatePostpone` and `proposeDayRebuild` return a
 * plan; `logEntry` returns a draft entry. Each becomes a card the user applies
 * or dismisses — the model cannot change a row by describing one, which is
 * what keeps a confident mistake from becoming a lost afternoon.
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
  {
    name: "proposeDayRebuild",
    description:
      "A rearranged plan for the rest of today under the stated constraints. Returns a proposal the user applies or dismisses; it changes nothing by itself.",
    parameters: {
      type: "OBJECT",
      properties: {
        constraints: {
          type: "STRING",
          description:
            'What has to hold, in the user\'s words: "keep the 4pm lab", "two hours for the assignment".',
        },
      },
      required: ["constraints"],
    },
  },
  {
    name: "logEntry",
    description:
      "Draft an entry the user might want to record — a task, a meal, an expense. Produces a draft for them to confirm. It is never saved by calling this.",
    parameters: {
      type: "OBJECT",
      properties: {
        type: {
          type: "STRING",
          enum: ["task", "meal", "expense", "habit"],
        },
        payload: {
          type: "STRING",
          description: "What to record, in plain words.",
        },
      },
      required: ["type", "payload"],
    },
  },
];

/** Tool names that may only ever produce a draft, never a committed change. */
export const PROPOSAL_ONLY_TOOLS = new Set([
  "simulatePostpone",
  "proposeDayRebuild",
  "logEntry",
]);

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
}): string {
  const { firstName, localTime, traits, healthDataAllowed } = input;

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
    "You cannot change anything. `simulatePostpone`, `proposeDayRebuild` and `logEntry` produce a proposal the user applies or dismisses themselves. Describe what you are proposing and why; never say you have done, saved, moved or logged something.",
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
  ]
    .filter((line) => line !== "")
    .join("\n");
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
