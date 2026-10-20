import { ArrowRight, Scale, Sparkles, Split, Wand2 } from "lucide-react";
import Link from "next/link";

import { TwinFallback } from "@/components/twin/twin-fallback";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

const differentiators = [
  {
    icon: Split,
    title: "One model of your commitments",
    body: "Classes, assignments, workouts, study sessions and personal time share a single schedule — which is the only way anything can reason about your time honestly.",
  },
  {
    icon: Scale,
    title: "Consequences before you decide",
    body: "“If this moves to tomorrow, tomorrow carries 5h 30m instead of 4h.” Calculated from your own entries, with the assumptions shown.",
  },
  {
    icon: Wand2,
    title: "A plan you negotiate",
    body: "The twin proposes; you accept, change or decline. Nothing in your plan moves until you say so, and recovery is always offered after a miss.",
  },
  {
    icon: Sparkles,
    title: "Explanations, not verdicts",
    body: "Every score says what it means and what it was built from. You are compared only with your own past — never with other people.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center gap-3 px-4">
        <span className="flex items-center gap-2">
          <span className="size-7">
            <TwinFallback state="balanced" label="" />
          </span>
          <span className="text-sm font-medium tracking-tight">Digital Twin</span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Log in</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/demo">Try the demo</Link>
          </Button>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-accent text-2xs font-medium tracking-wide uppercase">
              For students and working professionals
            </p>
            <h1 className="mt-3 text-3xl leading-tight font-medium tracking-tight sm:text-[2.75rem]">
              Your timetable, gym, money and goals finally talk to each other.
            </h1>
            <p className="text-muted-foreground mt-4 max-w-xl text-base">
              One app for each part of your life means none of them know what the
              others are asking of you. Your twin holds all of it in one place, tells
              you what a decision actually costs, and helps you recover when a day
              goes wrong.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button size="lg" asChild>
                <Link href="/signup">
                  Create your twin
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/twin">See the twin conversation</Link>
              </Button>
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              The demo runs on a sample profile. It never touches a real account.
            </p>
          </div>

          <div className="mx-auto w-full max-w-[18rem]">
            <TwinFallback state="balanced" label="The twin" />
          </div>
        </div>

        <section aria-labelledby="different-heading" className="mt-14">
          <h2 id="different-heading" className="text-lg font-medium">
            What makes it a twin rather than a dashboard
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {differentiators.map((item) => (
              <article
                key={item.title}
                className="bg-card shadow-card rounded-xl border p-4"
              >
                <span className="border-accent/25 bg-accent/10 text-accent inline-flex size-9 items-center justify-center rounded-lg border">
                  <item.icon className="size-4.5" aria-hidden />
                </span>
                <h3 className="mt-3 text-sm font-medium">{item.title}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm">{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="text-muted-foreground border-t px-4 py-5 text-xs">
        Your twin is not a doctor, dietitian or financial adviser. Projections are
        labelled as simulations, and personal context is only sent to the AI after you
        approve it.
      </footer>
    </div>
  );
}
