import { Check, Lock, TrendingDown, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ProgressRing, Sparkline } from "@/components/patterns/charts";
import { PageHeader } from "@/components/patterns/page-header";
import { GridSkeleton } from "@/components/patterns/states";
import { cn } from "@/lib/utils";
import { getInsightsRepo } from "@/lib/data/repo";
import { LIFE_GRAPH_MIN_DAYS } from "@/lib/domain/calc/insights";
import type { InsightsView } from "@/lib/data/insights.repo";

export const metadata: Metadata = { title: "Insights & reviews" };

export default function InsightsPage() {
  return (
    <Suspense fallback={<GridSkeleton count={4} />}>
      <InsightsContent />
    </Suspense>
  );
}

async function InsightsContent() {
  const repo = await getInsightsRepo();
  const view = await repo.getInsights(new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights &amp; reviews"
        description="Your own week, read back to you. Everything here compares you with your own past and nothing else."
        askAbout="my week"
      />

      <WeeklyReview view={view} />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Evolution view={view} />
        <LifeGraphPanel view={view} />
      </div>

      <Achievements view={view} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                weekly review                               */
/* -------------------------------------------------------------------------- */

/**
 * Three columns, every line quoting a number the user can go and check.
 *
 * Rule-based, not generated prose: each line comes from a stated threshold in
 * `weeklyReview`, so there is nothing here the user cannot trace back to their
 * own data.
 */
function WeeklyReview({ view }: { view: InsightsView }) {
  const { review } = view;
  const empty =
    review.wentWell.length === 0 &&
    review.slipped.length === 0 &&
    review.nextFocus.length === 0;

  return (
    <section
      aria-labelledby="review-heading"
      className="bg-card shadow-card rounded-xl border p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="review-heading" className="text-base font-medium">
          Your week
        </h2>
        <p className="text-muted-foreground text-xs">
          Week of{" "}
          {new Date(review.weekStart).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      {empty ? (
        <p className="text-muted-foreground mt-3 text-sm">
          Not enough logged this week to say anything useful yet. This fills in on its own
          as you use the other screens — there is nothing to set up here.
        </p>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          <Column title="Went well" lines={review.wentWell} tone="ok" />
          <Column title="Slipped" lines={review.slipped} tone="attention" />
          <Column title="Worth focusing on" lines={review.nextFocus} tone="neutral" />
        </div>
      )}
    </section>
  );
}

function Column({
  title,
  lines,
  tone,
}: {
  title: string;
  lines: string[];
  tone: "ok" | "attention" | "neutral";
}) {
  return (
    <div>
      <h3
        className={cn(
          "text-xs font-medium",
          tone === "ok" && "text-ok",
          tone === "attention" && "text-attention",
          tone === "neutral" && "text-muted-foreground",
        )}
      >
        {title}
      </h3>

      {lines.length === 0 ? (
        <p className="text-muted-foreground mt-1.5 text-xs">Nothing this week.</p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {lines.map((line) => (
            <li key={line} className="flex gap-2 text-xs leading-relaxed">
              <span aria-hidden className="text-muted-foreground">
                ·
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               twin evolution                               */
/* -------------------------------------------------------------------------- */

function Evolution({ view }: { view: InsightsView }) {
  const withData = view.evolution.filter((series) => series.points.length > 0);

  return (
    <section
      aria-labelledby="evolution-heading"
      className="bg-card shadow-card rounded-xl border p-4"
    >
      <h2 id="evolution-heading" className="text-base font-medium">
        How your twin has changed
      </h2>
      <p className="text-muted-foreground mt-0.5 text-xs">
        The last 30 days. A day with nothing logged is a gap, not a zero — the line is not
        drawn through days you did not use the app.
      </p>

      {withData.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">
          Nothing to plot yet. Your twin writes one snapshot a day; come back in a few days
          and these lines will have something in them.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {withData.map((series) => (
            <li key={series.key}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-medium">{series.label}</p>
                <p className="tabular flex items-center gap-1 font-mono text-xs">
                  {series.latest ?? "—"}
                  {series.change !== null && series.change !== 0 && (
                    <span
                      className={cn(
                        "flex items-center gap-0.5",
                        series.change > 0 ? "text-ok" : "text-attention",
                      )}
                    >
                      {series.change > 0 ? (
                        <TrendingUp className="size-3" aria-hidden />
                      ) : (
                        <TrendingDown className="size-3" aria-hidden />
                      )}
                      {series.change > 0 ? "+" : ""}
                      {series.change}
                    </span>
                  )}
                </p>
              </div>
              <Sparkline
                points={series.points.map((point) => point.value)}
                label={`${series.label} over the last ${series.points.length} days, now ${
                  series.latest ?? "unknown"
                } out of 100`}
                className="mt-1"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 life graph                                 */
/* -------------------------------------------------------------------------- */

/**
 * Correlations between areas of the user's life — or the lock.
 *
 * Locked below 21 days, and labelled "pattern, not proof" even when unlocked.
 * A correlation over three weeks of one person's life is suggestive at best,
 * and the product says so rather than presenting it as a finding.
 */
function LifeGraphPanel({ view }: { view: InsightsView }) {
  const graph = view.lifeGraph;

  return (
    <section
      aria-labelledby="graph-heading"
      className="bg-card shadow-card rounded-xl border p-4"
    >
      <h2 id="graph-heading" className="text-base font-medium">
        Life graph
      </h2>
      <p className="text-muted-foreground mt-0.5 text-xs">
        Where two parts of your life seem to move together.
      </p>

      {graph.locked ? (
        <div className="mt-4 flex flex-col items-center gap-3 text-center">
          <ProgressRing
            value={graph.daysCollected}
            max={graph.needed}
            centre={`${graph.daysCollected}`}
            sub={`of ${graph.needed} days`}
            label={`${graph.daysCollected} of ${graph.needed} days collected`}
          />
          <div>
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium">
              <Lock className="size-3.5" aria-hidden />
              {graph.daysCollected} of {graph.needed} days collected
            </p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-xs text-xs leading-relaxed">
              This stays shut until there are {LIFE_GRAPH_MIN_DAYS} days of history. A
              correlation over a few days is noise with a decimal point on it, and showing
              you one would be worse than showing you nothing.
            </p>
          </div>
        </div>
      ) : graph.correlations.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">
          {graph.daysCollected} days collected, and nothing in them moves together strongly
          enough to be worth a sentence. That is a real result, not a missing feature.
        </p>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {graph.correlations.map((correlation) => (
              <li
                key={`${correlation.aId}-${correlation.bId}`}
                className="bg-surface-2/50 rounded-lg border p-3"
              >
                <p className="text-xs leading-relaxed">{correlation.statement}</p>
                <p className="text-muted-foreground tabular mt-1.5 font-mono text-2xs">
                  r = {correlation.r} · {correlation.strength} · {correlation.days} days
                </p>
              </li>
            ))}
          </ul>

          <p className="text-muted-foreground mt-3 border-t pt-2 text-2xs leading-relaxed">
            <span className="font-medium">Pattern, not proof.</span> These are
            correlations in your own logs over {graph.daysCollected} days. They do not show
            that one thing caused the other, and something you have not logged could
            explain both.
          </p>
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                achievements                                */
/* -------------------------------------------------------------------------- */

function Achievements({ view }: { view: InsightsView }) {
  return (
    <section
      aria-labelledby="achievements-heading"
      className="bg-card shadow-card rounded-xl border p-4"
    >
      <h2 id="achievements-heading" className="text-base font-medium">
        Milestones
      </h2>
      <p className="text-muted-foreground mt-0.5 text-xs">
        Things worth noticing, unlocked once. No streaks, nothing that resets to zero, and
        nothing that nags.
      </p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {view.achievements.map((achievement) => {
          const unlocked = achievement.unlockedAt !== null;

          return (
            <li
              key={achievement.key}
              className={cn(
                "rounded-lg border p-3",
                unlocked ? "border-accent/35 bg-accent/5" : "bg-surface-2/40",
              )}
            >
              <p
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium",
                  !unlocked && "text-muted-foreground",
                )}
              >
                {unlocked ? (
                  <Check className="text-accent size-3.5" aria-hidden />
                ) : (
                  <Lock className="size-3.5" aria-hidden />
                )}
                {achievement.label}
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {achievement.requirement}
              </p>
              {unlocked && (
                <p className="text-muted-foreground mt-1 text-2xs">
                  {new Date(achievement.unlockedAt!).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
