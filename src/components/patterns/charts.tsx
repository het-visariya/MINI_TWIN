import { cn } from "cn";
import type { Domain } from "@/lib/design/tokens";

/**
 * The two chart forms this product needs, built from tokens and plain SVG/CSS.
 *
 * Colour rule: the accent is always "you" and never appears twice in one
 * figure. Everything you are compared against is a grey tint. Both charts
 * carry a legend and per-cell text, so no value is communicated by colour
 * alone and every figure is readable to a screen reader.
 */

type HeatmapRow = { domain: Domain; label: string; values: number[] };

/** Greyscale ramp. Index 0 is "nothing happened" and stays empty. */
const intensitySteps = [0, 0.1, 0.26, 0.48, 0.75];

export function Heatmap({
  days,
  rows,
  max = 4,
  /** Column to mark as today. The only accent in the figure. */
  todayIndex,
  className,
}: {
  days: string[];
  rows: HeatmapRow[];
  max?: number;
  todayIndex?: number;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[26rem] border-separate border-spacing-1 text-xs">
        <caption className="text-muted-foreground mb-2 text-left text-xs">
          Your week by activity. Darker means more of that activity on that day.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="text-muted-foreground w-28 text-left font-medium">
              Activity
            </th>
            {days.map((day, index) => (
              <th
                key={day}
                scope="col"
                className={cn(
                  "text-center font-medium",
                  index === todayIndex ? "text-accent" : "text-muted-foreground",
                )}
              >
                {day}
                {index === todayIndex && <span className="sr-only"> (today)</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="text-left font-medium">
                {row.label}
              </th>
              {row.values.map((value, index) => {
                const step = Math.min(
                  intensitySteps.length - 1,
                  Math.round((value / max) * (intensitySteps.length - 1)),
                );
                const isToday = index === todayIndex;
                const tint = isToday ? "var(--accent)" : "var(--foreground)";

                return (
                  <td key={`${row.label}-${days[index]}`} className="p-0">
                    <span
                      className={cn(
                        "tabular text-2xs flex h-8 items-center justify-center rounded-md border",
                        isToday ? "border-accent/40" : "border-border",
                      )}
                      style={{
                        backgroundColor: `color-mix(in oklab, ${tint} ${
                          intensitySteps[step] * 100
                        }%, transparent)`,
                      }}
                      title={`${row.label}, ${days[index]}: ${value}`}
                    >
                      {value > 0 ? value : ""}
                      <span className="sr-only">
                        {row.label} on {days[index]}: {value}
                      </span>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type TrendSeries = {
  label: string;
  values: number[];
  /**
   * The user's own line. Exactly one series in a chart should set this; it is
   * drawn in the accent, the rest in grey.
   */
  emphasis?: boolean;
  /** Projections are drawn dashed, matching the simulation treatment. */
  projected?: boolean;
};

const greySeries = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

export function TrendChart({
  series,
  labels,
  className,
}: {
  series: TrendSeries[];
  labels: string[];
  className?: string;
}) {
  const width = 320;
  const height = 120;
  const max = Math.max(...series.flatMap((item) => item.values), 100);

  const pathFor = (values: number[]) =>
    values
      .map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * width;
        const y = height - (value / max) * height;
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  /* Grey series are numbered independently of the accent one. */
  const strokes = series.map((item, index) => {
    if (item.emphasis) return "var(--accent)";
    const greyRank = series
      .slice(0, index)
      .filter((earlier) => !earlier.emphasis).length;
    return greySeries[greyRank % greySeries.length];
  });

  return (
    <figure className={cn("flex flex-col gap-3", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-32 w-full"
        role="img"
        aria-label={series
          .map(
            (item) =>
              `${item.label}: ${item.values.join(", ")} across ${labels.join(", ")}`,
          )
          .join(". ")}
      >
        {[0.25, 0.5, 0.75].map((line) => (
          <line
            key={line}
            x1={0}
            x2={width}
            y1={height * line}
            y2={height * line}
            stroke="var(--border)"
            strokeWidth="1"
          />
        ))}
        {series.map((item, index) => (
          <path
            key={item.label}
            d={pathFor(item.values)}
            fill="none"
            stroke={strokes[index]}
            strokeWidth={item.emphasis ? 2 : 1.5}
            strokeDasharray={item.projected ? "4 4" : undefined}
            strokeLinecap="round"
          />
        ))}
      </svg>

      <figcaption className="flex flex-wrap gap-3">
        {series.map((item, index) => (
          <span key={item.label} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className="h-0.5 w-3 rounded-full"
              style={{ backgroundColor: strokes[index] }}
            />
            {item.label}
            {item.projected && (
              <span className="text-muted-foreground">(projected)</span>
            )}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
