import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "cn";

export const metadata: Metadata = { title: "Set up your twin" };

/**
 * The resumable wizard frame. Each step saves on its own, steps can be skipped
 * where they are optional, and the user can leave and come back.
 */
const steps = [
  { slug: "about-you", label: "About you", optional: false },
  { slug: "academics", label: "Academics", optional: false },
  { slug: "routine", label: "Daily routine", optional: false },
  { slug: "health", label: "Health", optional: true },
  { slug: "finance", label: "Finance", optional: true },
  { slug: "career", label: "Career", optional: true },
  { slug: "tone", label: "Regreter tone", optional: false },
  { slug: "privacy", label: "Privacy & consent", optional: false },
];

export function generateStaticParams() {
  return steps.map((step) => ({ step: step.slug }));
}

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step: slug } = await params;
  const index = steps.findIndex((step) => step.slug === slug);
  if (index === -1) notFound();

  const step = steps[index];
  const previous = steps[index - 1];
  const next = steps[index + 1];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-8">
      <header>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            Step <span className="tabular text-foreground font-medium">{index + 1}</span>{" "}
            of <span className="tabular">{steps.length}</span>
          </p>
          {step.optional && (
            <p className="text-muted-foreground text-xs">
              Optional — you can skip this and add it later
            </p>
          )}
        </div>
        <Progress
          value={((index + 1) / steps.length) * 100}
          className="mt-2"
          aria-label={`Setup progress: step ${index + 1} of ${steps.length}`}
        />
        <h1 className="mt-5 text-xl font-semibold tracking-tight">{step.label}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Everything you enter here is yours, editable and deletable. The twin only
          uses what you allow it to use.
        </p>
      </header>

      <main id="main" className="mt-6 flex-1">
        <div className="bg-card shadow-card rounded-xl border p-4">
          <p className="text-sm font-medium">This step&rsquo;s form arrives in phase 2</p>
          <p className="text-muted-foreground mt-1 text-xs">
            The wizard frame, progress, resumability and the step order are in place.
            The fields are built with each module.
          </p>
        </div>

        <ol className="mt-4 space-y-1.5">
          {steps.map((other, otherIndex) => (
            <li key={other.slug}>
              <Link
                href={`/onboarding/${other.slug}`}
                aria-current={other.slug === slug ? "step" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-2.5 rounded-lg border px-3 text-sm transition-colors",
                  other.slug === slug
                    ? "border-primary/40 bg-primary/5 font-medium"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "tabular flex size-5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold",
                    otherIndex < index
                      ? "bg-ok/15 text-ok"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {otherIndex < index ? <Check className="size-3" aria-hidden /> : otherIndex + 1}
                </span>
                {other.label}
                {other.optional && (
                  <span className="text-muted-foreground ml-auto text-2xs">
                    Optional
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ol>
      </main>

      <footer className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
        <Button variant="ghost" asChild disabled={!previous}>
          <Link href={previous ? `/onboarding/${previous.slug}` : "/"}>
            <ArrowLeft aria-hidden />
            {previous ? previous.label : "Back"}
          </Link>
        </Button>

        <div className="flex gap-2">
          {step.optional && next && (
            <Button variant="outline" asChild>
              <Link href={`/onboarding/${next.slug}`}>Skip</Link>
            </Button>
          )}
          <Button asChild>
            <Link href={next ? `/onboarding/${next.slug}` : "/home"}>
              {next ? "Save and continue" : "Finish setup"}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </footer>
    </div>
  );
}
