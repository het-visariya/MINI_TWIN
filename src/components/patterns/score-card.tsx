"use client";

import { Info, TrendingDown, TrendingUp } from "lucide-react";

import { NumberFlow } from "@/components/motion/number-flow";
import { AskAboutThis } from "@/components/patterns/ask-about-this";
import { DomainIcon } from "@/components/patterns/domain-icon";
import { StatusChip } from "@/components/patterns/status-chip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Score } from "@/lib/domain/types";

/**
 * A score, its band and its trend against the user's own past.
 *
 * The Score type still requires `meaning` and `inputs` — no number renders
 * without its explanation — but the explanation now lives one tap away behind
 * the (i) button rather than as a paragraph on every card. Numbers first.
 */
export function ScoreExplainer({ score }: { score: Score }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`What goes into ${score.label}?`}
        >
          <Info aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm">
        <p className="font-medium">{score.label}</p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          {score.meaning}
        </p>
        <p className="mt-3 mb-1.5 text-xs font-medium">Built from</p>
        <ul className="text-muted-foreground space-y-1.5 text-xs">
          {score.inputs.map((input) => (
            <li key={input} className="flex gap-2">
              <span aria-hidden className="text-accent">
                •
              </span>
              <span>{input}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
          <p className="text-muted-foreground text-xs">
            Compared only with your own history.
          </p>
          <AskAboutThis subject={score.label.toLowerCase()} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ScoreTrend({ trend }: { trend: number }) {
  const down = trend < 0;
  const Icon = down ? TrendingDown : TrendingUp;

  return (
    <p
      className={cn(
        "flex items-center gap-1 text-xs",
        down ? "text-attention" : "text-ok",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="tabular font-mono">
        {trend > 0 ? "+" : ""}
        {trend}
      </span>
      <span className="text-muted-foreground">vs your 28-day average</span>
    </p>
  );
}

export function ScoreCard({
  score,
  compact = false,
  className,
}: {
  score: Score;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground shadow-card hover:border-border-strong flex flex-col gap-3 rounded-xl border p-5 transition-colors",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <DomainIcon domain={score.domain} />
          <p className="text-sm font-medium">{score.label}</p>
        </div>
        <ScoreExplainer score={score} />
      </div>

      <div className="flex items-end justify-between gap-3">
        <NumberFlow value={score.value} className="text-2xl leading-none" />
        <StatusChip kind={score.band} />
      </div>

      <Progress
        value={score.value}
        aria-label={`${score.label} score: ${score.value} out of 100`}
      />

      {!compact && score.trend !== undefined && <ScoreTrend trend={score.trend} />}
    </div>
  );
}
