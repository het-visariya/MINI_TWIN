import { ArrowRight, Clock, Dumbbell, ListChecks, Salad, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { AskAboutThis } from "@/components/patterns/ask-about-this";
import { ConflictBanner } from "@/components/patterns/conflict-banner";
import { DomainIcon } from "@/components/patterns/domain-icon";
import { ScoreCard } from "@/components/patterns/score-card";
import { CardSkeleton, GridSkeleton } from "@/components/patterns/states";
import { TimeBudgetBar } from "@/components/patterns/time-budget-bar";
import { TwinHero } from "@/components/twin/twin-hero";
import { TwinStateSync } from "@/components/twin/twin-state-sync";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { repo } from "@/lib/data/repo";

export const metadata: Metadata = { title: "Twin home" };

const quickActions = [
  { label: "Task", icon: ListChecks },
  { label: "Workout", icon: Dumbbell },
  { label: "Meal", icon: Salad },
  { label: "Expense", icon: Wallet },
];

const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const snapshot = await repo.getTwinSnapshot();

  return (
    <div className="space-y-6">
      <TwinStateSync state={snapshot.state} intensity={snapshot.intensity} />

      <TwinHero
        greeting={snapshot.greeting}
        oneThing={snapshot.oneThing}
        brief={snapshot.brief}
      />

      {snapshot.conflicts.map((conflict) => (
        <Reveal key={conflict.id}>
          <ConflictBanner conflict={conflict} />
        </Reveal>
      ))}

      <section aria-labelledby="pulse-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 id="pulse-heading" className="text-base font-medium">
              Twin pulse
            </h2>
            <p className="text-muted-foreground text-xs">
              Five short scores, each one explaining what it means and what it came
              from.
            </p>
          </div>
          <AskAboutThis subject="my twin pulse" />
        </div>

        <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {snapshot.pulse.map((score) => (
            <StaggerItem key={score.id}>
              <ScoreCard score={score} />
            </StaggerItem>
          ))}
          <StaggerItem>
            <ScoreCard score={snapshot.momentum} />
          </StaggerItem>
        </Stagger>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section
          aria-labelledby="today-heading"
          className="bg-card shadow-card rounded-xl border p-4"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 id="today-heading" className="text-base font-medium">
              Today
            </h2>
            <span className="text-muted-foreground tabular text-xs">
              {snapshot.today.length} commitments
            </span>
          </div>

          <ul className="divide-y">
            {snapshot.today.map((commitment) => (
              <li
                key={commitment.id}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <DomainIcon domain={commitment.domain} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{commitment.title}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {commitment.source}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-sm">{formatMinutes(commitment.minutes)}</p>
                  <p className="text-muted-foreground text-2xs capitalize">
                    {commitment.flexibility}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section
            aria-labelledby="budget-heading"
            className="bg-card shadow-card rounded-xl border p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="budget-heading" className="text-base font-medium">
                Your day, in hours
              </h2>
              <AskAboutThis subject="my time budget" />
            </div>
            <TimeBudgetBar budget={snapshot.timeBudget} />
          </section>

          <section
            aria-labelledby="quick-heading"
            className="bg-card shadow-card rounded-xl border p-4"
          >
            <h2 id="quick-heading" className="text-base font-medium">
              Quick actions
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Everything frequent is three taps or fewer. Press{" "}
              <kbd className="bg-muted rounded border px-1 py-0.5 text-2xs">⌘K</kbd>{" "}
              anywhere.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <Button key={action.label} variant="outline" className="justify-start">
                  <action.icon aria-hidden />
                  {action.label}
                </Button>
              ))}
            </div>
          </section>

          <section className="border-accent/25 bg-accent/5 rounded-xl border p-4">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Clock className="size-4" aria-hidden />
              Recovery is always available
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Missed something? Recovery Mode rebuilds the day into tonight, tomorrow
              and later — without moving anything until you agree.
            </p>
            <Button variant="secondary" size="sm" className="mt-3">
              Open recovery mode
              <ArrowRight aria-hidden />
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-card shadow-card grid gap-6 rounded-2xl border p-6 lg:grid-cols-[auto_1fr]">
        <Skeleton className="mx-auto size-48 rounded-full" />
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-44" />
          </div>
        </div>
      </div>
      <GridSkeleton count={6} />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <CardSkeleton lines={6} />
        <CardSkeleton lines={4} />
      </div>
    </div>
  );
}
