import { CalendarClock, Moon, Sun, Sunrise } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { ConflictBanner } from "@/components/patterns/conflict-banner";
import { DomainIcon } from "@/components/patterns/domain-icon";
import { PageHeader } from "@/components/patterns/page-header";
import { TimeBudgetBar } from "@/components/patterns/time-budget-bar";
import { Progress } from "@/components/ui/progress";
import { GridSkeleton } from "@/components/patterns/states";
import { repo } from "@/lib/data/repo";

export const metadata: Metadata = { title: "Goals & planning" };

const buckets = [
  { key: "tonight", label: "Tonight", icon: Moon },
  { key: "tomorrow", label: "Tomorrow", icon: Sunrise },
  { key: "later", label: "Later this week", icon: Sun },
] as const;

async function GoalsContent() {
  const { goals, capacity, timeBudget, conflicts, recovery } =
    await repo.getPlanning();

  const shortfall = capacity.requestedHours - capacity.availableHours;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goals & planning"
        description="What you have committed to, how many hours those commitments actually need, and what to do when they ask for more hours than the week has."
        askAbout="my goals this week"
      />

      {conflicts.map((conflict) => (
        <ConflictBanner key={conflict.id} conflict={conflict} />
      ))}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="goals-heading" className="space-y-3">
          <h2 id="goals-heading" className="text-base font-medium">
            Active goals
          </h2>

          <Stagger className="space-y-2.5">
            {goals.map((goal) => (
              <StaggerItem key={goal.id}>
                <article className="bg-card shadow-card rounded-xl border p-4">
                  <div className="flex items-start gap-3">
                    <DomainIcon domain={goal.domain} />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium">{goal.title}</h3>
                      <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="size-3.5" aria-hidden />
                          {new Date(goal.due).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                        {goal.needsHoursPerWeek > 0 && (
                          <span className="tabular">
                            {goal.needsHoursPerWeek}h / week needed
                          </span>
                        )}
                      </p>
                      <div className="mt-2.5 flex items-center gap-3">
                        <Progress
                          value={goal.progress}
                          aria-label={`${goal.title}: ${goal.progress} percent`}
                        />
                        <span className="tabular text-xs font-medium">
                          {goal.progress}%
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        <div className="space-y-6">
          <section
            aria-labelledby="detector-heading"
            className="bg-card shadow-card rounded-xl border p-4"
          >
            <h2 id="detector-heading" className="text-base font-medium">
              Goal conflict detector
            </h2>
            <p className="text-muted-foreground mt-1 mb-4 text-xs">
              The hours your active goals ask for, against the hours this week has
              after sleep, classes, commute and meals.
            </p>

            <TimeBudgetBar
              budget={{
                availableHours: capacity.availableHours,
                plannedHours: capacity.requestedHours,
                reserved: capacity.perGoal.map((goal) => ({
                  label: goal.label,
                  hours: goal.hours,
                })),
              }}
            />

            <p className="mt-4 text-xs">
              {shortfall > 0 ? (
                <>
                  <span className="text-risk font-medium">
                    Short by {shortfall} hours this week.
                  </span>{" "}
                  <span className="text-muted-foreground">
                    That is the gap to close — by moving something, shortening
                    something, or accepting slower progress on one goal. All three are
                    valid.
                  </span>
                </>
              ) : (
                <span className="text-ok font-medium">
                  Your goals fit the week as planned.
                </span>
              )}
            </p>
          </section>

          <section
            aria-labelledby="today-budget-heading"
            className="bg-card shadow-card rounded-xl border p-4"
          >
            <h2 id="today-budget-heading" className="mb-3 text-base font-medium">
              Today&rsquo;s time budget
            </h2>
            <TimeBudgetBar budget={timeBudget} />
          </section>
        </div>
      </div>

      <section
        aria-labelledby="recovery-heading"
        className="bg-card shadow-card rounded-xl border p-4"
      >
        <h2 id="recovery-heading" className="text-base font-medium">
          Recovery mode
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          After missed work, the day is rebuilt into tonight, tomorrow and later —
          with the flexible things moved first. Nothing is applied until you accept it.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {buckets.map((bucket) => (
            <div key={bucket.key} className="bg-surface-2/60 rounded-lg border p-3">
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <bucket.icon className="size-4" aria-hidden />
                {bucket.label}
              </h3>
              <ul className="mt-2.5 space-y-2">
                {recovery[bucket.key].map((item) => (
                  <li
                    key={item.label}
                    className="bg-card flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-xs"
                  >
                    <span className="min-w-0 truncate">{item.label}</span>
                    <span className="tabular text-muted-foreground shrink-0">
                      {item.minutes}m
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function GoalsPage() {
  return (
    <Suspense fallback={<GridSkeleton count={4} />}>
      <GoalsContent />
    </Suspense>
  );
}
