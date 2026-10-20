import { Clock } from "lucide-react";

import { cn } from "cn";
import type { TimeBudget } from "@/lib/domain/types";

const formatHours = (hours: number) => {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return minutes ? `${whole}h ${minutes}m` : `${whole}h`;
};

/**
 * Hours the plan needs against hours the day actually has, with the shortfall
 * named rather than implied. The reserved blocks are listed so the user can
 * see exactly what was subtracted from their day.
 */
export function TimeBudgetBar({
  budget,
  showReserved = true,
  className,
}: {
  budget: TimeBudget;
  showReserved?: boolean;
  className?: string;
}) {
  const shortfall = budget.plannedHours - budget.availableHours;
  const scale = Math.max(budget.plannedHours, budget.availableHours);
  const availableWidth = (budget.availableHours / scale) * 100;
  const plannedWidth = (budget.plannedHours / scale) * 100;
  const over = shortfall > 0;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Clock className="size-4" aria-hidden />
          Time budget
        </p>
        <p className="text-muted-foreground text-xs">
          <span className="tabular text-foreground font-medium">
            {formatHours(budget.plannedHours)}
          </span>{" "}
          planned ·{" "}
          <span className="tabular text-foreground font-medium">
            {formatHours(budget.availableHours)}
          </span>{" "}
          available
        </p>
      </div>

      <div
        className="bg-muted relative h-7 overflow-hidden rounded-lg"
        role="img"
        aria-label={`${formatHours(budget.plannedHours)} planned against ${formatHours(
          budget.availableHours,
        )} available${over ? `, ${formatHours(shortfall)} more than the day has` : ""}`}
      >
        <div
          className="bg-accent/25 absolute inset-y-0 left-0"
          style={{ width: `${availableWidth}%` }}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 border-r-2",
            over ? "border-risk bg-risk/20" : "border-accent bg-accent/40",
          )}
          style={{ width: `${plannedWidth}%` }}
        />
        <div
          className="border-foreground/40 absolute inset-y-0 border-r border-dashed"
          style={{ width: `${availableWidth}%` }}
        />
      </div>

      <p className={cn("text-xs", over ? "text-risk" : "text-ok")}>
        {over
          ? `Your plan is ${formatHours(shortfall)} longer than the time you have.`
          : `You have ${formatHours(-shortfall)} of slack left today.`}
      </p>

      {showReserved && (
        <dl className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          {budget.reserved.map((block) => (
            <div key={block.label} className="flex justify-between gap-2">
              <dt>{block.label}</dt>
              <dd className="tabular text-foreground">{formatHours(block.hours)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
