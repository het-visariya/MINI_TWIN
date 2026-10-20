import type { Metadata } from "next";
import { Suspense } from "react";

import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { PageHeader } from "@/components/patterns/page-header";
import { ScoreCard } from "@/components/patterns/score-card";
import { Heatmap } from "@/components/patterns/charts";
import { FocusTimer } from "@/components/productivity/focus-timer";
import { TaskRow } from "@/components/productivity/task-row";
import { Progress } from "@/components/ui/progress";
import { GridSkeleton } from "@/components/patterns/states";
import { repo } from "@/lib/data/repo";

export const metadata: Metadata = { title: "Productivity" };

async function ProductivityContent() {
  const { tasks, habits, heatmap, consistency, baseline } =
    await repo.getProductivity();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Productivity"
        description="What to do next, why it is next, and how this week compares with your own rhythm — never with anyone else's."
        askAbout="my productivity this week"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="tasks-heading" className="space-y-3">
          <div>
            <h2 id="tasks-heading" className="text-base font-semibold">
              Ranked by consequence
            </h2>
            <p className="text-muted-foreground text-xs">
              Urgency, importance, consequence and dependencies. Every task answers
              &ldquo;Why is this here?&rdquo;.
            </p>
          </div>

          <Stagger className="space-y-2.5">
            {tasks.map((task) => (
              <StaggerItem key={task.id}>
                <TaskRow task={task} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        <div className="space-y-6">
          <FocusTimer />
          <ScoreCard score={consistency} />
          <ScoreCard score={baseline} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section
          aria-labelledby="heatmap-heading"
          className="bg-card shadow-card rounded-xl border p-4"
        >
          <h2 id="heatmap-heading" className="text-base font-semibold">
            Life heatmap
          </h2>
          <p className="text-muted-foreground mt-1 mb-4 text-xs">
            Study, gym, focus, sleep and spending across the week — the view that
            shows where your time actually went.
          </p>
          <Heatmap days={heatmap.days} rows={heatmap.rows} />
        </section>

        <section
          aria-labelledby="habits-heading"
          className="bg-card shadow-card rounded-xl border p-4"
        >
          <h2 id="habits-heading" className="text-base font-semibold">
            Habits
          </h2>
          <p className="text-muted-foreground mt-1 mb-4 text-xs">
            A rolling 28-day count, so one missed day never resets you to zero.
          </p>

          <ul className="space-y-4">
            {habits.map((habit) => (
              <li key={habit.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <p className="text-sm">{habit.label}</p>
                  <p className="text-muted-foreground tabular text-xs">
                    <span className="text-foreground font-medium">
                      {habit.days28}
                    </span>
                    /28 days
                  </p>
                </div>
                <Progress
                  value={(habit.days28 / 28) * 100}
                  aria-label={`${habit.label}: ${habit.days28} of the last 28 days`}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default function ProductivityPage() {
  return (
    <Suspense fallback={<GridSkeleton count={4} />}>
      <ProductivityContent />
    </Suspense>
  );
}
