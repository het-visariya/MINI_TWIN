import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/wizard";
import { requireViewer } from "@/lib/auth/session";
import { isOnboardingSlug } from "@/lib/onboarding/steps";

/*
 * Blocking rather than streamed: this route decides whether the visitor may
 * see the page at all. A redirect cannot be streamed inside a Suspense
 * fallback — the shell would paint first and the user would see a flash of an
 * app they are not logged into — so the session check runs before any HTML.
 */
export const instant = false;

export const metadata: Metadata = { title: "Set up your twin" };

/**
 * One route per step, so setup is resumable and shareable between devices:
 * the saved `onboardingStep` is a URL, not client state that dies with the tab.
 */
export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step: slug } = await params;
  if (!isOnboardingSlug(slug)) notFound();

  const viewer = await requireViewer(`/onboarding/${slug}`);

  /* Setup writes to a Profile, which demo mode does not have. */
  if (viewer.kind === "demo") redirect("/home");
  if (viewer.kind !== "user") redirect("/login");

  if (viewer.profile.onboardingCompletedAt) redirect("/home");

  const traits = (viewer.profile.traits ?? {}) as Record<string, unknown>;

  return (
    <OnboardingWizard
      slug={slug}
      name={viewer.name}
      saved={{
        name: viewer.name,
        lifeStage: viewer.profile.lifeStage,
        regreterTone: viewer.profile.regreterTone,
        sex: viewer.profile.sex,
        hasMedicalCondition: viewer.profile.hasMedicalCondition,
        aiConsent: Boolean(viewer.profile.aiConsentAt),
        allowHealthDataToAi: viewer.profile.allowHealthDataToAi,
        allowMoneyDataToAi: viewer.profile.allowMoneyDataToAi,
        traits,
      }}
      dob={viewer.profile.dob.toISOString()}
    />
  );
}
