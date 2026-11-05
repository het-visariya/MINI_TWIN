"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { Reveal } from "@/components/motion/reveal";
import { twinStateLabel, useTwinState } from "@/components/twin/twin-state";
import { TwinVisual } from "@/components/twin/twin-visual";
import { Button } from "@/components/ui/button";

/**
 * The top of the Twin screen: the twin itself, the single most important
 * action, and the reason it is that action.
 */
export function TwinHero({
  greeting,
  oneThing,
  brief,
}: {
  greeting: string;
  oneThing: { title: string; reason: string };
  brief: string[];
}) {
  const { state } = useTwinState();

  return (
    <Reveal className="bg-card shadow-card overflow-hidden rounded-2xl border">
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="mx-auto flex flex-col items-center gap-2 lg:mx-0">
          <TwinVisual />
          <p className="text-muted-foreground max-w-[16rem] text-center text-2xs">
            {twinStateLabel[state]}
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">{greeting}</p>

          <p className="text-accent mt-4 text-2xs font-medium tracking-wide uppercase">
            Your one thing
          </p>
          <h1 className="mt-1 text-xl leading-snug font-medium tracking-tight sm:text-2xl">
            {oneThing.title}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            {oneThing.reason}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="lg">
              Start this now
              <ArrowRight aria-hidden />
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href={{ pathname: "/regreter", query: { about: "one-thing" } }}>
                <Sparkles aria-hidden />
                What if I postpone it?
              </Link>
            </Button>
          </div>

          {brief.length > 0 && (
            <ul className="mt-5 space-y-1.5 border-t pt-4">
              {brief.map((line) => (
                <li key={line} className="text-muted-foreground flex gap-2 text-xs">
                  <span aria-hidden className="text-accent">
                    •
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Reveal>
  );
}
