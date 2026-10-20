import { StatusChip } from "@/components/patterns/status-chip";
import { cn } from "cn";

/**
 * The wrapper for anything projected rather than measured.
 *
 * Future Self, CGPA what-if, FutureMe paths and the bunk budget all render
 * inside this. It states that the content is a simulation and lists the
 * assumptions behind the figures, so a projection is never mistaken for a
 * record of something that happened.
 */
export function SimulationFrame({
  title,
  assumptions,
  children,
  className,
}: {
  title: string;
  assumptions: string[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("simulation-frame rounded-xl p-4", className)}
      aria-describedby="simulation-assumptions"
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <StatusChip kind="simulation" />
      </header>

      {children}

      <footer id="simulation-assumptions" className="border-simulation/25 mt-4 border-t pt-3">
        <p className="text-foreground text-xs font-medium">This assumes</p>
        <ul className="text-muted-foreground mt-1.5 space-y-1 text-xs">
          {assumptions.map((assumption) => (
            <li key={assumption} className="flex gap-2">
              <span aria-hidden className="text-simulation">
                •
              </span>
              <span>{assumption}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-2 text-xs">
          A projection from the information you have entered — not a prediction, and
          not a measurement.
        </p>
      </footer>
    </section>
  );
}
