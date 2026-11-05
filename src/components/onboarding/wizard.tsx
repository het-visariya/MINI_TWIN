"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useBitsTheme } from "@/components/bits/use-bits-theme";
import { Step, Stepper } from "@/components/bits/twin-bits";
import { FormError } from "@/components/auth/fields";
import { MeetYourTwin } from "@/components/onboarding/meet-your-twin";
import { StepFields, type SavedAnswers } from "@/components/onboarding/step-fields";
import { Button } from "@/components/ui/button";
import {
  ONBOARDING_STEPS,
  stepBefore,
  stepIndex,
  type OnboardingSlug,
} from "@/lib/onboarding/steps";
import { saveStep, skipStep } from "@/lib/onboarding/actions";

/**
 * The setup wizard.
 *
 * The Stepper runs in controlled mode: the route is the source of truth, not
 * the component's internal counter. That is what makes setup resumable — the
 * saved step is a URL, so closing the tab and coming back on another device
 * lands in the same place.
 *
 * Each step posts only its own fields, so a validation failure on step 5 never
 * costs the user steps 1 to 4.
 */
export function OnboardingWizard({
  slug,
  name,
  saved,
  dob,
}: {
  slug: OnboardingSlug;
  name: string;
  saved: SavedAnswers;
  dob: string;
}) {
  const router = useRouter();
  const { mode, colors } = useBitsTheme();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const index = stepIndex(slug);
  const step = ONBOARDING_STEPS[index];
  const previous = stepBefore(slug);
  const isLast = index === ONBOARDING_STEPS.length - 1;

  function go(path: string) {
    setErrors({});
    router.push(path);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveStep(slug, formData);
      if (result.ok) go(result.next);
      else setErrors(result.errors);
    });
  }

  function onSkip() {
    startTransition(async () => {
      const result = await skipStep(slug);
      if (result.ok) go(result.next);
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-8">
      <header>
        <p className="text-muted-foreground text-xs">
          Step <span className="tabular font-mono text-foreground">{index + 1}</span> of{" "}
          <span className="tabular font-mono">{ONBOARDING_STEPS.length}</span>
          {step.optional && " · optional"}
        </p>

        <Stepper
          step={index + 1}
          onStepChange={(next) => {
            /* Indicators only go back to a step already answered; going
               forward has to happen through Continue so the step saves. */
            const target = ONBOARDING_STEPS[next - 1];
            if (target && next - 1 < index) go(`/onboarding/${target.slug}`);
          }}
          indicator="bars"
          transition="none"
          showFooter={false}
          frame={false}
          linear
          theme={mode}
          accentColor={colors.accent}
          width="100%"
          className="mt-3"
        >
          {ONBOARDING_STEPS.map((entry) => (
            <Step key={entry.slug} />
          ))}
        </Stepper>

        <h1 className="mt-6 text-xl">{step.title}</h1>
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
          {step.blurb}
        </p>
      </header>

      <main id="main" className="mt-6 flex-1">
        <FormError>{errors._}</FormError>

        {isLast ? (
          <MeetYourTwin name={name} saved={saved} />
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <div className="bg-card rounded-xl border p-5">
              <StepFields slug={slug} saved={saved} dob={dob} errors={errors} />
            </div>

            <footer className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                disabled={!previous || pending}
                onClick={() => previous && go(`/onboarding/${previous}`)}
              >
                <ArrowLeft aria-hidden />
                Back
              </Button>

              <div className="flex gap-2">
                {step.optional && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={onSkip}
                  >
                    Skip for now
                  </Button>
                )}
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save and continue"}
                  <ArrowRight aria-hidden />
                </Button>
              </div>
            </footer>
          </form>
        )}
      </main>

      <p className="text-muted-foreground mt-8 text-xs leading-relaxed">
        Everything you enter is yours, editable and deletable. Your twin only uses
        what you allow it to use, and it asks before sending anything to an AI model.
      </p>
    </div>
  );
}
