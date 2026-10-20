/**
 * Demo fixtures — the "Try demo" sample profile.
 *
 * Every figure here is sample data for a fictional user. Screens must not
 * import this file directly; they go through src/lib/data/repo.ts so the
 * fixtures can be replaced by real queries without touching any screen.
 */

import type {
  Commitment,
  Conflict,
  Consequence,
  CostReceipt,
  Score,
  ScenarioPath,
  Simulation,
  Task,
  TimeBudget,
  TwinMessage,
} from "@/lib/domain/types";

const today = (hour: number, minute = 0) => {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const inDays = (days: number, hour = 23, minute = 59) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

/* ------------------------------- commitments ------------------------------ */

export const createCommitments = (): Commitment[] => [
  {
    id: "c-dbms",
    title: "DBMS lecture",
    domain: "academic",
    minutes: 60,
    start: today(9),
    flexibility: "fixed",
    priority: "normal",
    source: "Timetable · Monday",
  },
  {
    id: "c-os-lab",
    title: "OS lab",
    domain: "academic",
    minutes: 120,
    start: today(11),
    flexibility: "fixed",
    priority: "high",
    source: "Timetable · Monday",
  },
  {
    id: "c-commute",
    title: "Commute",
    domain: "routine",
    minutes: 70,
    flexibility: "fixed",
    priority: "normal",
    source: "Routine you set during onboarding",
  },
  {
    id: "c-dbms-assign",
    title: "DBMS assignment 3 — remaining work",
    domain: "academic",
    minutes: 120,
    flexibility: "shiftable",
    priority: "critical",
    dependsOn: ["c-dbms"],
    source: "Due tomorrow 11:59 pm",
  },
  {
    id: "c-gym",
    title: "Gym — push session",
    domain: "health",
    minutes: 60,
    start: today(19),
    flexibility: "flexible",
    priority: "normal",
    source: "4 planned sessions this week",
  },
  {
    id: "c-dsa",
    title: "DSA practice",
    domain: "career",
    minutes: 45,
    flexibility: "flexible",
    priority: "normal",
    source: "Backend developer roadmap · week 6",
  },
];

/* ---------------------------------- scores -------------------------------- */

export const pulse: Score[] = [
  {
    id: "s-academic",
    label: "Academic",
    domain: "academic",
    value: 62,
    band: "attention",
    meaning:
      "One assignment is due tomorrow with 2 hours of work left, and DBMS attendance is close to your 75% requirement.",
    inputs: ["Assignment 3 unfinished", "DBMS attendance 76%", "Internals in 12 days"],
    trend: -6,
  },
  {
    id: "s-fitness",
    label: "Fitness",
    domain: "health",
    value: 74,
    band: "ok",
    meaning: "You have kept 3 of 4 planned sessions in each of the last three weeks.",
    inputs: ["3 of 4 sessions last week", "Sleep logged 6 of 7 nights"],
    trend: 3,
  },
  {
    id: "s-productivity",
    label: "Productivity",
    domain: "productivity",
    value: 58,
    band: "attention",
    meaning:
      "You are completing fewer tasks than your own 28-day average, mostly tasks you had estimated at under 30 minutes.",
    inputs: ["9 of 16 tasks done this week", "Your 28-day average is 12"],
    trend: -4,
  },
  {
    id: "s-career",
    label: "Career",
    domain: "career",
    value: 45,
    band: "attention",
    meaning:
      "Your backend roadmap expects 3 practice sessions a week; you logged 1 last week.",
    inputs: ["1 of 3 practice sessions", "2 of 6 roadmap skills at target level"],
    trend: -2,
  },
  {
    id: "s-routine",
    label: "Routine",
    domain: "routine",
    value: 81,
    band: "ok",
    meaning: "Sleep and meal times have stayed within an hour of your usual pattern.",
    inputs: ["Sleep window 00:30–07:15", "Meals logged 5 of 7 days"],
    trend: 1,
  },
];

export const momentum: Score = {
  id: "s-momentum",
  label: "Momentum",
  domain: "goals",
  value: 64,
  band: "attention",
  meaning:
    "A rolling 28-day view of task completion, study consistency, attendance, workouts and goal progress. It is compared only with your own past, never with other people.",
  inputs: [
    "Task completion 56%",
    "Study consistency 11 of 28 days",
    "Attendance 82%",
    "Workouts 11 of 16 planned",
  ],
  trend: -3,
};

/* -------------------------------- planning -------------------------------- */

export const timeBudget: TimeBudget = {
  availableHours: 4.5,
  plannedHours: 6.25,
  reserved: [
    { label: "Sleep", hours: 7.5 },
    { label: "Classes & lab", hours: 3 },
    { label: "Commute", hours: 1.2 },
    { label: "Meals & breaks", hours: 1.8 },
  ],
};

export const conflicts: Conflict[] = [
  {
    id: "k-today",
    summary:
      "Today's plan needs 6h 15m but you have 4h 30m left after classes, commute and meals.",
    domains: ["academic", "health", "career"],
    severity: "risk",
    shortfallHours: 1.75,
    resolutions: [
      {
        id: "k-today-1",
        label: "Protect the assignment, shorten the gym session",
        detail:
          "Keep the full 2 hours on DBMS assignment 3 and drop the gym session to 30 minutes. Your weekly session count stays at 4.",
      },
      {
        id: "k-today-2",
        label: "Move DSA practice to Thursday",
        detail:
          "Thursday currently has 2h 10m free. This keeps today's gym session intact and the roadmap week on track.",
      },
      {
        id: "k-today-3",
        label: "Split the assignment across tonight and tomorrow morning",
        detail:
          "90 minutes tonight, 30 minutes before the 9 am lecture. Tomorrow morning is currently free.",
      },
    ],
  },
];

export const consequences: Consequence[] = [
  {
    id: "q-assignment",
    question: "DBMS assignment 3 has 2 hours left and is due tomorrow 11:59 pm.",
    assumptions: [
      "Your own estimate of 2 hours remaining",
      "Tomorrow already holds 3 hours of classes and 1 hour of planned work",
      "Late submissions lose 20% in this subject, per the rule you entered",
    ],
    options: [
      {
        id: "q-assignment-now",
        label: "Finish it tonight",
        cost: "2 hours tonight, gym session drops to 30 minutes",
        recommended: true,
        effects: [
          {
            domain: "academic",
            statement: "Submitted on time; no late penalty applied.",
            direction: "better",
          },
          {
            domain: "health",
            statement: "Session shortened, still your 4th this week.",
            direction: "neutral",
          },
        ],
      },
      {
        id: "q-assignment-postpone",
        label: "Postpone to tomorrow",
        cost: "Tomorrow's load rises from 4 hours to 5h 30m after re-planning",
        effects: [
          {
            domain: "academic",
            statement:
              "Submission moves to within 3 hours of the deadline, with the 20% late penalty if it slips.",
            direction: "worse",
          },
          {
            domain: "productivity",
            statement:
              "Two tasks already planned for tomorrow would need to move to Thursday.",
            direction: "worse",
          },
          {
            domain: "health",
            statement: "Tonight's full gym session stays.",
            direction: "better",
          },
        ],
      },
    ],
  },
];

/* ---------------------------------- tasks --------------------------------- */

export const createTasks = (): Task[] => [
  {
    id: "t-1",
    title: "DBMS assignment 3 — normalisation section",
    domain: "academic",
    due: inDays(1),
    estimateMinutes: 120,
    progress: 60,
    priority: "critical",
    why: "Due in 1 day, 2 hours of your own estimate left, and this subject applies a 20% late penalty.",
  },
  {
    id: "t-2",
    title: "OS lab record — write up experiment 6",
    domain: "academic",
    due: inDays(2),
    estimateMinutes: 45,
    progress: 0,
    priority: "high",
    why: "Due in 2 days and it blocks the lab viva checklist you added.",
  },
  {
    id: "t-3",
    title: "DSA — two array problems",
    domain: "career",
    due: inDays(3),
    estimateMinutes: 45,
    progress: 0,
    priority: "normal",
    why: "Week 6 of your backend roadmap expects 3 sessions; you have logged 1.",
  },
  {
    id: "t-4",
    title: "Pay hostel mess bill",
    domain: "finance",
    due: inDays(4),
    estimateMinutes: 10,
    progress: 0,
    priority: "high",
    why: "Fixed date, 10 minutes, and it has a late fee you recorded last month.",
  },
  {
    id: "t-5",
    title: "Read 10 pages — Operating Systems chapter 4",
    domain: "academic",
    estimateMinutes: 30,
    progress: 0,
    priority: "low",
    why: "Internals are 12 days away; starting now spreads the reading across 6 sessions.",
  },
];

export const habits = [
  { id: "h-1", label: "Sleep before 00:30", days28: 19, domain: "routine" as const },
  { id: "h-2", label: "Study session logged", days28: 11, domain: "academic" as const },
  { id: "h-3", label: "Workout", days28: 11, domain: "health" as const },
  { id: "h-4", label: "Water target met", days28: 16, domain: "health" as const },
];

/** Weekly intensity grid: 7 days × the domains shown on the life heatmap. */
export const heatmap = {
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  rows: [
    { domain: "academic" as const, label: "Study", values: [3, 2, 4, 1, 2, 0, 1] },
    { domain: "health" as const, label: "Gym", values: [1, 0, 1, 0, 1, 1, 0] },
    { domain: "productivity" as const, label: "Focus", values: [2, 3, 2, 1, 3, 1, 0] },
    { domain: "routine" as const, label: "Sleep 7h+", values: [1, 1, 0, 1, 0, 1, 1] },
    { domain: "finance" as const, label: "Spending", values: [1, 2, 1, 3, 2, 4, 1] },
  ],
};

/* --------------------------------- academic ------------------------------- */

export const subjects = [
  {
    id: "sub-dbms",
    name: "DBMS",
    credits: 4,
    difficulty: "high" as const,
    attendance: { attended: 19, held: 25, required: 75 },
    grade: { expected: "B+", internal: 21, internalMax: 30 },
  },
  {
    id: "sub-os",
    name: "Operating Systems",
    credits: 4,
    difficulty: "high" as const,
    attendance: { attended: 22, held: 26, required: 75 },
    grade: { expected: "A", internal: 25, internalMax: 30 },
  },
  {
    id: "sub-cn",
    name: "Computer Networks",
    credits: 3,
    difficulty: "medium" as const,
    attendance: { attended: 20, held: 24, required: 75 },
    grade: { expected: "A-", internal: 23, internalMax: 30 },
  },
  {
    id: "sub-maths",
    name: "Discrete Maths",
    credits: 3,
    difficulty: "medium" as const,
    attendance: { attended: 15, held: 23, required: 75 },
    grade: { expected: "B", internal: 18, internalMax: 30 },
  },
];

export const academicRisk: Score = {
  id: "s-risk",
  label: "Academic risk",
  domain: "academic",
  value: 55,
  band: "attention",
  meaning:
    "Medium. Two things drive it: Discrete Maths attendance is 65% against a 75% requirement, and one assignment is due tomorrow with work left.",
  inputs: [
    "Discrete Maths attendance 65%",
    "DBMS assignment 3 unfinished",
    "Internals in 12 days",
  ],
};

export const cgpaSimulation: Simulation<{
  current: number;
  projected: number;
  perSubject: { name: string; expected: string; credits: number }[];
}> = {
  kind: "simulation",
  horizon: "30-day",
  assumptions: [
    "Grades you selected, not predicted grades",
    "Internal marks stay as recorded today",
    "Credit weights from the scheme you entered during onboarding",
  ],
  data: {
    current: 7.82,
    projected: 7.95,
    perSubject: [
      { name: "DBMS", expected: "B+", credits: 4 },
      { name: "Operating Systems", expected: "A", credits: 4 },
      { name: "Computer Networks", expected: "A-", credits: 3 },
      { name: "Discrete Maths", expected: "B", credits: 3 },
    ],
  },
};

/** The cascade a single missed assignment sets off, stage by stage. */
export const deadlineCascade = [
  { stage: "Assignment 3 missed", detail: "0 of 10 assignment marks for this unit." },
  { stage: "Internals", detail: "Internal total falls from 21/30 to 18/30 in DBMS." },
  { stage: "Grade", detail: "Expected DBMS grade moves from B+ towards B." },
  {
    stage: "CGPA",
    detail: "Projected CGPA moves from 7.95 to about 7.86 on the grades you selected.",
  },
];

/* ---------------------------------- goals --------------------------------- */

export const createGoals = () => [
  {
    id: "g-1",
    title: "Clear internals with 8.0+ CGPA",
    domain: "academic" as const,
    progress: 58,
    due: inDays(12),
    needsHoursPerWeek: 9,
  },
  {
    id: "g-2",
    title: "Backend developer roadmap — week 6 of 20",
    domain: "career" as const,
    progress: 30,
    due: inDays(98),
    needsHoursPerWeek: 5,
  },
  {
    id: "g-3",
    title: "4 gym sessions a week",
    domain: "health" as const,
    progress: 72,
    due: inDays(30),
    needsHoursPerWeek: 4,
  },
  {
    id: "g-4",
    title: "Save ₹6,000 for the AWS certification fee",
    domain: "finance" as const,
    progress: 45,
    due: inDays(60),
    needsHoursPerWeek: 0,
  },
];

/** Hours the active goals ask for against the hours the week actually has. */
export const weeklyCapacity = {
  availableHours: 16,
  requestedHours: 18,
  perGoal: [
    { label: "Internals", hours: 9 },
    { label: "Backend roadmap", hours: 5 },
    { label: "Gym", hours: 4 },
  ],
};

/** Recovery Mode output after missed work: tonight / tomorrow / later. */
export const recoveryPlan = {
  tonight: [
    { label: "DBMS assignment 3 — normalisation", minutes: 90 },
    { label: "Gym — shortened session", minutes: 30 },
  ],
  tomorrow: [
    { label: "DBMS assignment 3 — final pass", minutes: 30 },
    { label: "OS lab record", minutes: 45 },
  ],
  later: [
    { label: "DSA practice (Thursday)", minutes: 45 },
    { label: "OS chapter 4 reading (Friday)", minutes: 30 },
  ],
};

/* -------------------------------- regreter -------------------------------- */

export const costReceipts: CostReceipt[] = [
  {
    id: "r-1",
    missed: "Discrete Maths lecture on Friday",
    effects: [
      {
        domain: "academic",
        statement: "Attendance moved from 68% to 65%, against a 75% requirement.",
        direction: "worse",
      },
      {
        domain: "academic",
        statement:
          "You can now miss 0 more classes before you fall below the requirement, and need 4 consecutive classes to recover.",
        direction: "worse",
      },
    ],
    recovery: {
      label: "Attend the next 4 Discrete Maths classes",
      detail:
        "That returns attendance to 76%. The next class is Wednesday 10 am — want it added as a protected block?",
    },
  },
];

export const plansInThree = [
  {
    id: "p3-1",
    wish: "Finish the DBMS assignment tonight",
    obstacle: "I usually open my phone after dinner and lose an hour",
    ifThen:
      "If I finish dinner, then I put my phone on the shelf and start a 45-minute timer.",
  },
];

/* ------------------------------- future self ------------------------------ */

export const futurePaths: Simulation<ScenarioPath[]> = {
  kind: "simulation",
  horizon: "7-day",
  assumptions: [
    "Your current timetable and the commitments you have entered",
    "Your own time estimates, not measured work rates",
    "No new commitments appear this week",
  ],
  data: [
    {
      id: "path-priorities",
      label: "If you do today's priorities",
      summary:
        "The assignment is submitted on time, Thursday absorbs the DSA session, and the week ends with 4 gym sessions logged.",
      outcomes: [
        { domain: "academic", label: "Academic", value: 74 },
        { domain: "career", label: "Career", value: 52 },
        { domain: "health", label: "Fitness", value: 74 },
        { domain: "productivity", label: "Productivity", value: 68 },
      ],
    },
    {
      id: "path-postpone",
      label: "If you keep postponing",
      summary:
        "Tomorrow carries 5h 30m, two tasks move to Thursday, and the roadmap week closes with 1 of 3 practice sessions.",
      outcomes: [
        { domain: "academic", label: "Academic", value: 54 },
        { domain: "career", label: "Career", value: 41 },
        { domain: "health", label: "Fitness", value: 70 },
        { domain: "productivity", label: "Productivity", value: 49 },
      ],
    },
  ],
};

/* ------------------------------ conversation ------------------------------ */

export const conversation: TwinMessage[] = [
  {
    id: "m-1",
    author: "user",
    text: "Why am I falling behind this week?",
  },
  {
    id: "m-2",
    author: "twin",
    text: "Three things, in the order they matter. Your week asks for 18 hours across active goals but has 16 available, so something had to slip. The slipped items were mostly short academic tasks — 9 of 16 done against your own 28-day average of 12. And Friday's missed Discrete Maths class moved attendance to 65%, which now needs 4 classes to recover. Nothing here is unusual for an internals month; the shortfall is 2 hours a week, not a collapse.",
    sources: [
      { label: "Weekly capacity", value: "16h available / 18h requested" },
      { label: "Tasks completed", value: "9 of 16 (your average: 12)" },
      { label: "Discrete Maths attendance", value: "65% (requirement 75%)" },
    ],
    suggestions: [
      "Where do the 2 hours come from?",
      "Rebuild this week for me",
      "Just the assignment for now",
    ],
  },
  {
    id: "m-3",
    author: "user",
    text: "Rebuild this week for me, but keep the gym.",
  },
  {
    id: "m-4",
    author: "twin",
    text: "Here is a version that keeps all 4 gym sessions. It takes the 2 hours from DSA practice and the OS reading, both of which have slack before their deadlines. Have a look and change anything you disagree with.",
    consent: [
      {
        label: "Timetable and deadlines",
        detail: "Class times, assignment due dates and your internal marks",
      },
      {
        label: "Planned sessions",
        detail: "Gym and study sessions you have scheduled this week",
      },
    ],
    proposal: {
      id: "pp-1",
      summary: "Keep 4 gym sessions; move 2 hours of flexible work to next week.",
      status: "proposed",
      changes: [
        {
          label: "Tonight",
          detail: "90 minutes on DBMS assignment 3, 30-minute gym session.",
        },
        {
          label: "Tomorrow",
          detail: "30 minutes to finish the assignment before the 9 am lecture.",
        },
        {
          label: "Thursday",
          detail: "DSA practice moves here, into the 2h 10m that is free.",
        },
        {
          label: "Next week",
          detail: "OS chapter 4 reading shifts to Monday and Wednesday.",
        },
      ],
    },
  },
];

export const briefLines = [
  "2 hours of assignment work left, due tomorrow night.",
  "Today's plan is 1h 45m longer than the time you have.",
  "Discrete Maths attendance is at 65% — 4 classes to recover.",
];
