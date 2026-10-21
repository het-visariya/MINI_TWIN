"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useReducedMotion } from "motion/react";

import { ScoreExplainer } from "@/components/patterns/score-card";
import { cn } from "@/lib/utils";
import type { Score } from "@/lib/domain/types";

/**
 * One Twin Pulse score as a compact ring gauge.
 *
 * Twin Pulse replaced six equal score cards: the headline number is Momentum,
 * and these five rings sit under it. A ring shows the value and its direction
 * and nothing else — the meaning is behind the (i) button.
 */
const SIZE = 56;
const STROKE = 4;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export function PulseRing({
  score,
  selected = false,
  onSelect,
  className,
}: {
  score: Score;
  selected?: boolean;
  /** Highlights this score's band on the twin figure. */
  onSelect?: (score: Score) => void;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const offset = CIRC * (1 - Math.min(100, Math.max(0, score.value)) / 100);
  const down = (score.trend ?? 0) < 0;
  const Trend = down ? TrendingDown : TrendingUp;

  const gauge = (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden
      className="shrink-0"
    >
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        fill="none"
        stroke="var(--border)"
        strokeWidth={STROKE}
      />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        style={
          reduced
            ? undefined
            : { transition: "stroke-dashoffset var(--duration-slow) var(--ease-twin)" }
        }
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground font-mono text-[0.8125rem]"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {score.value}
      </text>
    </svg>
  );

  const body = (
    <>
      {gauge}
      <span className="min-w-0 text-left">
        <span className="block truncate text-xs font-medium">{score.label}</span>
        {score.trend !== undefined && (
          <span
            className={cn(
              "mt-0.5 flex items-center gap-0.5 text-xs",
              down ? "text-attention" : "text-ok",
            )}
          >
            <Trend className="size-3" aria-hidden />
            <span className="tabular font-mono">
              {score.trend > 0 ? "+" : ""}
              {score.trend}
            </span>
          </span>
        )}
      </span>
    </>
  );

  const label = `${score.label}: ${score.value} out of 100${
    score.trend !== undefined
      ? `, ${down ? "down" : "up"} ${Math.abs(score.trend)} points against your 28-day average`
      : ""
  }`;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(score)}
          aria-pressed={selected}
          aria-label={`${label}. Highlight on your twin.`}
          className={cn(
            "flex min-h-11 items-center gap-2.5 rounded-lg border p-1.5 pr-2.5 transition-colors",
            selected
              ? "border-accent/40 bg-accent/5"
              : "hover:bg-surface-2 border-transparent",
          )}
        >
          {body}
        </button>
      ) : (
        <div className="flex items-center gap-2.5 p-1.5" role="img" aria-label={label}>
          {body}
        </div>
      )}
      <ScoreExplainer score={score} />
    </div>
  );
}
