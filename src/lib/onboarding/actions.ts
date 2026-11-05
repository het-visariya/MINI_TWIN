"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db";
import {
  LAST_STEP,
  STEP_SCHEMAS,
  TRAIT_KEYS,
  isOnboardingSlug,
  stepAfter,
  stepIndex,
  type OnboardingSlug,
} from "@/lib/onboarding/steps";

/**
 * One server action for the whole wizard.
 *
 * Every call re-checks the session: the proxy and the layout both run before
 * this, but an action is its own entry point and a caller could reach it
 * directly. `requireUser` also refuses demo mode, so a demo visitor cannot
 * write a Profile row.
 */

export type StepResult =
  | { ok: true; next: string }
  | { ok: false; errors: Record<string, string> };

export async function saveStep(
  slug: string,
  formData: FormData,
): Promise<StepResult> {
  if (!isOnboardingSlug(slug)) {
    return { ok: false, errors: { _: "Unknown setup step." } };
  }

  const { userId, profile } = await requireUser();

  const schema = STEP_SCHEMAS[slug];
  const parsed = schema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      errors[key] ??= issue.message;
    }
    return { ok: false, errors };
  }

  const answers = parsed.data as Record<string, unknown>;
  const prisma = getPrisma();

  /* Columns the twin's behaviour or a safety rule depends on get their own
     field; everything that is a stated habit or preference goes to traits. */
  const data: Record<string, unknown> = {};

  if (slug === "about-you" && typeof answers.name === "string") {
    await prisma.user.update({ where: { id: userId }, data: { name: answers.name } });
  }

  if (slug === "life-stage") data.lifeStage = answers.lifeStage;
  if (slug === "tone") data.regreterTone = answers.regreterTone;

  if (slug === "health") {
    data.hasMedicalCondition = Boolean(answers.hasMedicalCondition);
    if (answers.sex) data.sex = answers.sex;
  }

  if (slug === "privacy") {
    data.allowHealthDataToAi = Boolean(answers.allowHealthDataToAi);
    data.allowMoneyDataToAi = Boolean(answers.allowMoneyDataToAi);
    data.aiConsentAt = answers.aiConsent ? new Date() : null;
  }

  /* Hours are stored alongside the raw minutes because the time budget reads
     hours and the routine form edits minutes. */
  if (slug === "routine") {
    const wake = Number(answers.wakeHour);
    const sleep = Number(answers.sleepHour);
    answers.sleepHours = (wake - sleep + 24) % 24 || 8;
    answers.commuteHours = Number(answers.commuteMinutes ?? 0) / 60;
  }

  const traits = {
    ...((profile.traits ?? {}) as Record<string, unknown>),
    ...pickTraits(answers),
  } as Prisma.InputJsonValue;

  /* Only ever moves forward, so going back to edit an earlier step does not
     make the user redo the rest. */
  const furthest =
    stepIndex(slug) > stepIndex(profile.onboardingStep) ? slug : profile.onboardingStep;

  const next = stepAfter(slug);

  await prisma.profile.update({
    where: { userId },
    data: {
      ...data,
      traits,
      onboardingStep: next ?? furthest,
      ...(slug === LAST_STEP ? { onboardingCompletedAt: new Date() } : {}),
    },
  });

  if (slug === "privacy" && answers.aiConsent) {
    await prisma.aiConsentLog.create({
      data: {
        userId,
        feature: "onboarding",
        categories: consentCategories(answers),
        summary: "Consent granted during setup for the twin to read your own data.",
        granted: true,
      },
    });
  }

  revalidatePath("/onboarding", "layout");

  return { ok: true, next: next ? `/onboarding/${next}` : "/home" };
}

/** "Skip for now" on an optional step: advances without writing answers. */
export async function skipStep(slug: string): Promise<StepResult> {
  if (!isOnboardingSlug(slug)) {
    return { ok: false, errors: { _: "Unknown setup step." } };
  }

  const { userId, profile } = await requireUser();
  const next = stepAfter(slug as OnboardingSlug);

  await getPrisma().profile.update({
    where: { userId },
    data: {
      onboardingStep:
        next ??
        (stepIndex(slug) > stepIndex(profile.onboardingStep) ? slug : profile.onboardingStep),
    },
  });

  return { ok: true, next: next ? `/onboarding/${next}` : "/home" };
}

/** The last step's button. Marks setup done and sends them to Home. */
export async function finishOnboarding() {
  const { userId } = await requireUser();

  await getPrisma().profile.update({
    where: { userId },
    data: { onboardingStep: LAST_STEP, onboardingCompletedAt: new Date() },
  });

  revalidatePath("/home");
  redirect("/home");
}

/* -------------------------------------------------------------------------- */

function formDataToObject(formData: FormData) {
  const object: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    /* An unchecked checkbox posts nothing at all, so "on" is the only truthy
       value a checkbox can send and empty strings must stay absent rather
       than becoming 0 through coercion. */
    if (value === "") continue;
    object[key] = value === "on" ? true : value;
  }

  return object;
}

function pickTraits(answers: Record<string, unknown>) {
  const traits: Record<string, unknown> = {};

  for (const key of TRAIT_KEYS) {
    if (answers[key] !== undefined) traits[key] = answers[key];
  }

  return traits;
}

function consentCategories(answers: Record<string, unknown>) {
  const categories = ["Your plan, tasks and scores"];
  if (answers.allowHealthDataToAi) categories.push("Health and nutrition logs");
  if (answers.allowMoneyDataToAi) categories.push("Spending and budget");
  return categories;
}
