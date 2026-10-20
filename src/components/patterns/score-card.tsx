"use client";

import { Info, TrendingDown, TrendingUp } from "lucide-react";

import { NumberFlow } from "@/components/motion/number-flow";
import { AskAboutThis } from "@/components/patterns/ask-about-this";
import { DomainIcon } from "@/components/patterns/domain-icon";
import { StatusChip } from "@/components/patterns/status-chip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { cn } from "cn";
import type { Score } from "@/lib/domain/types";

/**
 * A score, its band, its trend against the user's own past, and — required by
 * the Score type — what the number means and which inputs produced it.
 *
 * No score renders without its explanation. That rule is the reason `meaning`
 * and `inputs` are not optional on Score.
 */
export function ScoreCard({
  score,
  compact = false,
  className,
}: {
  score: Score;
  compact?: boolean;
  className?: string;
}) {
  const Trend = (score.trend ?? 0) < 0 ? TrendingDown : TrendingUp;
  const trendTone = (score.trend ?? 0) < 0 ? "text-attention" : "text-ok";

  return (
    <div
      className={cn(
        "bg-card text-card-foreground shadow-card flex flex-col gap-3 rounded-xl border p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <DomainIcon domain={score.domain} />
          <div>
            <p className="text-sm font-medium">{score.label}</p>
            {score.trend !== undefined && (
              <p className={cn("flex items-center gap-1 text-xs", trendTone)}>
                <Trend className="size-3.5" aria-hidden />
                <span className="tabular">
                  {score.trend > 0 ? "+" : ""}
                  {score.trend}
                </span>
                <span className="text-muted-foreground">vs your 28-day average</span>
              </p>
            )}
          </div>
        </div>
        {!compact && <AskAboutThis subject={score.label.toLowerCase()} />}
      </div>

      <div className="flex items-end justify-between gap-3">
        <NumberFlow value={score.value} className="text-2xl font-semibold" />
        <StatusChip kind={score.band} />
      </div>

      <Progress
        value={score.value}
        aria-label={`${score.label} score: ${score.value} out of 100`}
      />

      <p className="text-muted-foreground text-xs leading-relaxed">{score.meaning}</p>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="-ml-2 self-start">
            <Info aria-hidden />
            What goes into this?
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 text-sm">
          <p className="mb-2 font-medium">{score.label} is built from</p>
          <ul className="text-muted-foreground space-y-1.5">
            {score.inputs.map((input) => (
              <li key={input} className="flex gap-2">
                <span aria-hidden className="text-primary">
                  •
                </span>
                <span>{input}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-3 border-t pt-2 text-xs">
            Compared only with your own history. Nothing here is a comparison with
            other people.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
