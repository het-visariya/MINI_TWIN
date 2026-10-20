import { z } from "zod";

/**
 * The setup wizard, defined once.
 *
 * The order matters and is not arbitrary: life stage comes second because it
 * changes which academic questions make sense, and the privacy/consent step
 * comes last before meeting the twin so the user has seen everything the twin
 * will be able to read before they agree to it.
 *
 * Each step owns its own schema. "Next" saves that step alone, so leaving
 * halfway through loses nothing and the wizard resumes from `onboardingStep`.
 */

export const ONBOARDING_STEPS = [
  {
    slug: "about-you",
    label: "About you",
    title: "What should your twin call you?",
    blurb: "Only your name and how you like to be spoken to. Nothing here is public.",
    optional: false,
  },
  {
    slug: "life-stage",
    label: "Life stage",
    title: "Where are you right now?",
    blurb: "This changes which academic questions are worth asking you.",
    optional: false,
  },
  {
    slug: "academics",
    label: "Academics",
    title: "What are you studying?",
    blurb: "Subjects and attendance rules. You can add the full timetable later.",
    optional: true,
  },
  {
    slug: "health",
    label: "Health basics",
    title: "The basics your twin should know",
    blurb: "Used for your own targets and nothing else. Every field is optional.",
    optional: true,
  },
  {
    slug: "routine",
    label: "Daily routine",
    title: "How does a normal day run?",
    blurb:
      "This is what lets your twin tell you how many hours your day actually has.",
    optional: false,
  },
  {
    slug: "money",
    label: "Money",
    title: "Money, roughly",
    blurb: "Enough to track a budget. No bank connection, ever.",
    optional: true,
  },
  {
    slug: "career",
    label: "Career",
    title: "Where are you heading?",
    blurb: "Your twin uses this to show the gap between now and that role.",
    optional: true,
  },
  {
    slug: "tone",
    label: "Regreter tone",
    title: "How should your twin talk to you?",
    blurb: "You can change this whenever you like. It will never insult you.",
    optional: false,
  },
  {
    slug: "privacy",
    label: "Privacy & AI",
    title: "What your twin may read",
    blurb: "Nothing is sent to an AI model until you allow it here.",
    optional: false,
  },
  {
    slug: "meet-your-twin",
    label: "Meet your twin",
    title: "Your twin is ready",
    blurb: "Here is what it already knows, and the three things worth learning.",
    optional: false,
  },
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export type OnboardingSlug = OnboardingStep["slug"];

export const FIRST_STEP: OnboardingSlug = ONBOARDING_STEPS[0].slug;
export const LAST_STEP: OnboardingSlug =
  ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1].slug;

export function stepIndex(slug: string): number {
  return ONBOARDING_STEPS.findIndex((step) => step.slug === slug);
}

export function isOnboardingSlug(slug: string): slug is OnboardingSlug {
  return stepIndex(slug) !== -1;
}

/** Where to send someone resuming setup. Falls back to the first step. */
export function nextOnboardingPath(savedStep: string | null | undefined) {
  const slug = savedStep && isOnboardingSlug(savedStep) ? savedStep : FIRST_STEP;
  return `/onboarding/${slug}`;
}

export function stepAfter(slug: OnboardingSlug): OnboardingSlug | null {
  const next = ONBOARDING_STEPS[stepIndex(slug) + 1];
  return next ? next.slug : null;
}

export function stepBefore(slug: OnboardingSlug): OnboardingSlug | null {
  const index = stepIndex(slug);
  const previous = index > 0 ? ONBOARDING_STEPS[index - 1] : undefined;
  return previous ? previous.slug : null;
}

/* -------------------------------------------------------------------------- */
/*                              per-step schemas                              */
/* -------------------------------------------------------------------------- */

const hour = z.coerce.number().int().min(0).max(23);

export const aboutYouSchema = z.object({
  name: z.string().trim().min(1, "Your twin needs something to call you.").max(80),
  pronouns: z.string().trim().max(40).optional(),
});

export const lifeStageSchema = z.object({
  lifeStage: z.enum(["SCHOOL", "COLLEGE", "OTHER"]),
});

export const academicsSchema = z.object({
  institution: z.string().trim().max(120).optional(),
  /** One subject per line, so the first step is typing, not a form builder. */
  subjects: z.string().trim().max(2000).optional(),
  minAttendancePct: z.coerce.number().int().min(0).max(100).default(75),
});

export const healthSchema = z.object({
  heightCm: z.coerce.number().min(80).max(250).optional(),
  weightKg: z.coerce.number().min(20).max(400).optional(),
  sex: z.enum(["FEMALE", "MALE", "PREFER_NOT_TO_SAY"]).optional(),
  hasMedicalCondition: z.coerce.boolean().default(false),
  gymDaysPerWeek: z.coerce.number().int().min(0).max(7).optional(),
  dietType: z.enum(["vegetarian", "eggetarian", "non-vegetarian", "vegan"]).optional(),
  /** Free text, shown back as a blocking warning before a flagged meal saves. */
  allergies: z.string().trim().max(300).optional(),
});

export const routineSchema = z.object({
  wakeHour: hour,
  sleepHour: hour,
  commuteMinutes: z.coerce.number().int().min(0).max(300).default(0),
  mealsPerDay: z.coerce.number().int().min(1).max(6).default(3),
  chronotype: z.enum(["morning", "night", "unsure"]).default("unsure"),
  studyBlockMinutes: z.coerce.number().int().min(15).max(180).default(50),
});

export const moneySchema = z.object({
  monthlyIncomeRupees: z.coerce.number().min(0).max(10_000_000).optional(),
  monthlyBudgetRupees: z.coerce.number().min(0).max(10_000_000).optional(),
  savingGoal: z.string().trim().max(160).optional(),
});

export const careerSchema = z.object({
  targetRole: z.string().trim().max(120).optional(),
  gradYear: z.coerce.number().int().min(1980).max(2100).optional(),
});

export const toneSchema = z.object({
  regreterTone: z.enum(["GENTLE", "BALANCED", "DIRECT", "NO_MERCY"]),
  motivationStyle: z.enum(["encouragement", "facts", "deadlines"]).default("facts"),
});

export const privacySchema = z.object({
  aiConsent: z.coerce.boolean().default(false),
  allowHealthDataToAi: z.coerce.boolean().default(false),
  allowMoneyDataToAi: z.coerce.boolean().default(false),
});

export const STEP_SCHEMAS = {
  "about-you": aboutYouSchema,
  "life-stage": lifeStageSchema,
  academics: academicsSchema,
  health: healthSchema,
  routine: routineSchema,
  money: moneySchema,
  career: careerSchema,
  tone: toneSchema,
  privacy: privacySchema,
  /* Nothing to collect — it is the reveal. */
  "meet-your-twin": z.object({}),
} satisfies Record<OnboardingSlug, z.ZodType>;

/**
 * Which answers are habits or preferences rather than facts. Everything listed
 * here lands in `Profile.traits` and is what Jarvis personalises from, so the
 * set is explicit instead of "whatever the form posted".
 */
export const TRAIT_KEYS = [
  "pronouns",
  "institution",
  "minAttendancePct",
  "heightCm",
  "weightKg",
  "gymDaysPerWeek",
  "dietType",
  "allergies",
  "wakeHour",
  "sleepHour",
  "sleepHours",
  "commuteHours",
  "commuteMinutes",
  "mealsPerDay",
  "chronotype",
  "studyBlockMinutes",
  "monthlyIncomeRupees",
  "monthlyBudgetRupees",
  "savingGoal",
  "targetRole",
  "gradYear",
  "motivationStyle",
] as const;
