import { cn } from "@/lib/utils";
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

/* -------------------------------------------------------------------------- */
/*                      added for the phase-2 modules                         */
/* -------------------------------------------------------------------------- */

type Bar = {
  label: string;
  value: number;
  /** The accent bar. At most one per chart, and it always means "you". */
  emphasis?: boolean;
  /** Shown in the tooltip and to screen readers instead of the raw number. */
  display?: string;
};

/**
 * Vertical bars for a short series: weekly training volume, spend per day.
 *
 * Every bar carries its own label and its value as text, so the figure is
 * readable without seeing the heights and without distinguishing the colours.
 * An all-zero series renders flat rather than dividing by zero.
 */
export function BarChart({
  bars,
  caption,
  unit = "",
  className,
}: {
  bars: Bar[];
  caption: string;
  unit?: string;
  className?: string;
}) {
  const max = Math.max(...bars.map((bar) => bar.value), 0);

  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <div className="flex h-28 items-end gap-1.5" role="img" aria-label={caption}>
        {bars.map((bar) => {
          const height = max === 0 ? 0 : (bar.value / max) * 100;

          return (
            <div key={bar.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span
                className={cn(
                  "w-full rounded-t-sm transition-[height]",
                  bar.emphasis ? "bg-accent" : "bg-chart-2/50",
                )}
                style={{ height: `${Math.max(height, bar.value > 0 ? 3 : 0)}%` }}
                title={`${bar.label}: ${bar.display ?? `${bar.value}${unit}`}`}
              />
              <span className="text-muted-foreground w-full truncate text-center text-2xs">
                {bar.label}
              </span>
            </div>
          );
        })}
      </div>
      <figcaption className="text-muted-foreground text-xs">{caption}</figcaption>
      <ul className="sr-only">
        {bars.map((bar) => (
          <li key={`sr-${bar.label}`}>
            {bar.label}: {bar.display ?? `${bar.value}${unit}`}
          </li>
        ))}
      </ul>
    </figure>
  );
}

/**
 * Horizontal rows with a filled track: spend by category, skill gaps.
 *
 * `target` draws a grey outline behind the fill, which is how the career skill
 * chart shows "you" against "what the role asks for" without using two
 * colours that have to be told apart.
 */
export function BarRows({
  rows,
  caption,
  className,
}: {
  rows: {
    label: string;
    value: number;
    display: string;
    /** Scale maximum for this row. Defaults to the largest value present. */
    target?: number;
    emphasis?: boolean;
    /** Right-hand note, e.g. "needs level 4". */
    note?: string;
  }[];
  caption: string;
  className?: string;
}) {
  const max = Math.max(...rows.map((row) => row.target ?? row.value), 0);

  return (
    <figure className={cn("flex flex-col gap-3", className)}>
      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => {
          const scale = row.target ?? max;
          const fill = scale === 0 ? 0 : Math.min(100, (row.value / scale) * 100);

          return (
            <li key={row.label} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-xs font-medium">{row.label}</span>
                <span className="tabular text-muted-foreground shrink-0 font-mono text-xs">
                  {row.display}
                  {row.note && <span className="ml-1.5">{row.note}</span>}
                </span>
              </div>
              <span
                className="bg-muted relative block h-2 overflow-hidden rounded-full border"
                role="img"
                aria-label={`${row.label}: ${row.display}${row.note ? `, ${row.note}` : ""}`}
              >
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full",
                    row.emphasis === false ? "bg-chart-2/60" : "bg-accent",
                  )}
                  style={{ width: `${fill}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
      <figcaption className="text-muted-foreground text-xs">{caption}</figcaption>
    </figure>
  );
}

/**
 * A progress ring: water against its range, spend against budget, days
 * collected against the 21 the Life Graph needs.
 *
 * The centre text is the value, never only the ring — a ring at 60% and a ring
 * at 70% are not distinguishable at this size.
 */
export function ProgressRing({
  value,
  max,
  centre,
  sub,
  label,
  size = 96,
  className,
}: {
  value: number;
  max: number;
  /** Large text in the middle. */
  centre: string;
  /** Small text under it. */
  sub?: string;
  /** What a screen reader hears. */
  label: string;
  size?: number;
  className?: string;
}) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      role="img"
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset var(--duration-slow) var(--ease-twin)" }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="tabular font-mono text-sm font-medium">{centre}</span>
        {sub && <span className="text-muted-foreground text-2xs">{sub}</span>}
      </span>
    </div>
  );
}

/**
 * A bare sparkline for the Twin Evolution cards.
 *
 * Gaps in the data stay gaps: a day with no snapshot is simply not a point, so
 * the line is drawn per contiguous run rather than through the missing days.
 */
export function Sparkline({
  points,
  label,
  className,
}: {
  points: number[];
  label: string;
  className?: string;
}) {
  const width = 120;
  const height = 32;

  if (points.length === 0) {
    return (
      <p className={cn("text-muted-foreground text-2xs", className)}>
        Not enough history yet
      </p>
    );
  }

  const max = Math.max(...points, 100);
  const min = Math.min(...points, 0);
  const span = max - min || 1;

  const path = points
    .map((value, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-8 w-full", className)}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
