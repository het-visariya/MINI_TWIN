import { cn } from "cn";
import { domainHue } from "@/lib/design/tokens";
import type { Domain } from "@/lib/design/tokens";

/**
 * The two chart forms this product needs, built from tokens and plain SVG/CSS.
 *
 * Both carry a legend and per-cell text, so no value is communicated by colour
 * alone and every figure is readable to a screen reader.
 */

type HeatmapRow = { domain: Domain; label: string; values: number[] };

const intensitySteps = ["0", "0.18", "0.4", "0.65", "0.9"];

export function Heatmap({
  days,
  rows,
  max = 4,
  className,
}: {
  days: string[];
  rows: HeatmapRow[];
  max?: number;
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
            {days.map((day) => (
              <th
                key={day}
                scope="col"
                className="text-muted-foreground text-center font-medium"
              >
                {day}
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

                return (
                  <td key={`${row.label}-${days[index]}`} className="p-0">
                    <span
                      className="tabular flex h-8 items-center justify-center rounded-md border text-2xs"
                      style={{
                        backgroundColor: `color-mix(in oklab, ${
                          domainHue[row.domain].light
                        } ${Number(intensitySteps[step]) * 100}%, transparent)`,
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
  domain: Domain;
  label: string;
  values: number[];
};

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
        {series.map((item) => (
          <path
            key={item.label}
            d={pathFor(item.values)}
            fill="none"
            stroke={`var(--domain-${item.domain})`}
            strokeWidth="2"
            strokeLinecap="round"
          />
        ))}
      </svg>

      <figcaption className="flex flex-wrap gap-3">
        {series.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: `var(--domain-${item.domain})` }}
            />
            {item.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
