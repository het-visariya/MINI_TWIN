"use client";

import { ArrowRight, Command, Gauge, Target } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import type { SavedAnswers } from "@/components/onboarding/step-fields";
import { TwinVisual } from "@/components/twin/twin-visual";
import { useTwinState } from "@/components/twin/twin-state";
import { Button } from "@/components/ui/button";
import { finishOnboarding } from "@/lib/onboarding/actions";

/**
 * The reveal.
 *
 * The figure assembles rather than appearing: it starts `resting` and dim,
 * then settles to `balanced` at the intensity the user's own answers imply, so
 * the first time they see their twin it is visibly theirs. The three cards
 * name the only three things worth knowing on Home — anything more and nobody
 * reads any of it.
 */
export function MeetYourTwin({
  name,
  saved,
}: {
  name: string;
  saved: SavedAnswers;
}) {
  const { setState, setIntensity } = useTwinState();
  const [assembled, setAssembled] = useState(false);
  const [pending, startTransition] = useTransition();

  /* How much the user told us, used as the twin's starting energy. Someone who
     filled in everything gets a fuller figure than someone who skipped. */
  const filled = countAnswers(saved);
  const intensity = Math.min(0.7, 0.25 + filled * 0.05);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setState("balanced");
      setIntensity(intensity);
      setAssembled(true);
    }, 600);

    return () => window.clearTimeout(id);
  }, [setState, setIntensity, intensity]);

  return (
    <div>
      <div className="bg-card flex flex-col items-center gap-4 rounded-xl border p-6 text-center">
        <div className="w-full max-w-[14rem]">
          <TwinVisual size="hero" />
        </div>

        <div>
          <p className="text-sm font-medium">
            {assembled ? `This is your twin, ${firstName(name)}.` : "Putting it together…"}
          </p>
          <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm leading-relaxed">
            {filled > 0
              ? `It knows ${filled} thing${filled === 1 ? "" : "s"} about how your days run. The more you log, the better it gets at telling you what a decision costs.`
              : "You skipped most of the setup, which is fine — add a class, a task or a workout and it starts working straight away."}
          </p>
        </div>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        <TourCard
          icon={Target}
          title="Your one thing"
          body="The single thing worth doing next, and the reason it came first."
        />
        <TourCard
          icon={Gauge}
          title="Twin Pulse"
          body="Five numbers comparing this week with your own past. Never with anyone else."
        />
        <TourCard
          icon={Command}
          title="Press ⌘J"
          body="Talk to your twin from any screen. It answers from your numbers."
        />
      </ul>

      <Button
        size="lg"
        className="mt-6 w-full"
        disabled={pending}
        onClick={() => startTransition(() => finishOnboarding())}
      >
        {pending ? "Opening your twin…" : "Go to my twin"}
        <ArrowRight aria-hidden />
      </Button>
    </div>
  );
}

function TourCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Target;
  title: string;
  body: string;
}) {
  return (
    <li className="bg-card rounded-xl border p-4">
      <span className="text-accent border-accent/40 bg-accent/10 inline-flex size-8 items-center justify-center rounded-md border">
        <Icon className="size-4" aria-hidden />
      </span>
      <p className="mt-2.5 text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{body}</p>
    </li>
  );
}

/** Stated answers only — never a count of fields we inferred. */
function countAnswers(saved: SavedAnswers) {
  const traits = Object.values(saved.traits).filter(
    (value) => value !== null && value !== undefined && value !== "",
  ).length;

  return traits + (saved.lifeStage ? 1 : 0);
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}
