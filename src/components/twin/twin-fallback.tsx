import { cn } from "cn";

import { buildTwinPoints } from "@/components/twin/twin-points";
import type { TwinState } from "@/lib/domain/types";

const stateShape: Record<TwinState, { spread: number; accent: number; opacity: number }> =
  {
    focused: { spread: 0.92, accent: 0.12, opacity: 1 },
    balanced: { spread: 1, accent: 0.1, opacity: 0.95 },
    stretched: { spread: 1.06, accent: 0.22, opacity: 1 },
    resting: { spread: 0.86, accent: 0.08, opacity: 0.68 },
  };

/** Enough points to read as the same figure, few enough to stay cheap as DOM. */
const FALLBACK_COUNT = 420;

/**
 * The twin as static SVG, built from the same point sampler as the canvas, so
 * switching between them is not a change of identity.
 *
 * This replaces the canvas — it is not a dimmed version of it — whenever WebGL
 * is unavailable, the viewport is small, the connection is metered, the user
 * prefers reduced motion, or the twin animation is switched off in settings.
 * It renders the state's end position and does not move.
 */
export function TwinFallback({
  state = "balanced",
  className,
  label,
}: {
  state?: TwinState;
  className?: string;
  label?: string;
}) {
  const shape = stateShape[state];
  const { position, seed } = buildTwinPoints(FALLBACK_COUNT);

  return (
    <svg
      viewBox="-1.4 -1.4 2.8 2.8"
      className={cn("size-full", className)}
      role="img"
      aria-label={label ?? "Your twin"}
      style={{ opacity: shape.opacity }}
    >
      {Array.from({ length: FALLBACK_COUNT }).map((_, i) => {
        const z = position[i * 3 + 2];
        /* Points behind the figure are smaller and fainter — the same depth
           cue the shader gives, without a frame loop. */
        const depth = (z + 1) / 2;
        const edge = Math.max(0, 1 - Math.abs(z));
        const radius = shape.spread + edge * (shape.spread > 1 ? 0.18 : 0);
        const isAccent = seed[i] > 1 - shape.accent;

        return (
          <circle
            key={i}
            cx={position[i * 3] * radius}
            cy={-position[i * 3 + 1] * radius}
            r={0.012 + depth * 0.008}
            fill={isAccent ? "var(--accent)" : "var(--foreground)"}
            fillOpacity={isAccent ? 0.9 : 0.25 + depth * 0.4}
          />
        );
      })}
    </svg>
  );
}
