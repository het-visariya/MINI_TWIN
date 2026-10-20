"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const lengths = [25, 50] as const;

/** A focus session. No streaks, no penalties for stopping early. */
export function FocusTimer() {
  const [minutes, setMinutes] = useState<number>(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;

    const interval = window.setInterval(() => {
      setRemaining((previous) => {
        if (previous <= 1) {
          setRunning(false);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [running]);

  const reset = (next = minutes) => {
    setRunning(false);
    setMinutes(next);
    setRemaining(next * 60);
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const elapsed = ((minutes * 60 - remaining) / (minutes * 60)) * 100;

  return (
    <section
      aria-labelledby="focus-heading"
      className="bg-card shadow-card rounded-xl border p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="focus-heading" className="text-base font-semibold">
          Focus session
        </h2>
        <ToggleGroup
          type="single"
          value={String(minutes)}
          onValueChange={(value) => value && reset(Number(value))}
          aria-label="Session length"
        >
          {lengths.map((length) => (
            <ToggleGroupItem key={length} value={String(length)} className="text-xs">
              {length}m
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <p
        className="tabular mt-4 text-center text-3xl font-semibold"
        role="timer"
        aria-live="off"
      >
        {mm}:{ss}
      </p>

      <Progress
        value={elapsed}
        className="mt-3"
        aria-label={`Focus session ${Math.round(elapsed)} percent elapsed`}
      />

      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={() => setRunning((previous) => !previous)}>
          {running ? <Pause aria-hidden /> : <Play aria-hidden />}
          {running ? "Pause" : remaining === minutes * 60 ? "Start" : "Resume"}
        </Button>
        <Button variant="outline" size="icon" onClick={() => reset()} aria-label="Reset timer">
          <RotateCcw aria-hidden />
        </Button>
      </div>

      <p className="text-muted-foreground mt-3 text-2xs">
        Stopping early is logged as time spent, not as a failed session.
      </p>
    </section>
  );
}
