import { cn } from "cn";

import type { TwinState } from "@/lib/domain/types";

const stateRing: Record<TwinState, { outer: number; inner: number }> = {
  focused: { outer: 0.9, inner: 0.52 },
  balanced: { outer: 0.82, inner: 0.46 },
  stretched: { outer: 0.74, inner: 0.4 },
  resting: { outer: 0.66, inner: 0.34 },
};

/**
 * The twin as static SVG. Shares the geometry of the 3D version so switching
 * between them is not a change of identity.
 *
 * This replaces the canvas — it is not a dimmed version of it — whenever WebGL
 * is unavailable, the viewport is small, the connection is metered, the user
 * prefers reduced motion, or the twin animation is switched off in settings.
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
  const ring = stateRing[state];

  return (
    <svg
      viewBox="0 0 200 200"
      className={cn("size-full", className)}
      role="img"
      aria-label={label ?? "Your twin"}
    >
      <defs>
        <radialGradient id="twin-core" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.95" />
          <stop offset="60%" stopColor="var(--primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--ai)" stopOpacity="0.12" />
        </radialGradient>
      </defs>

      <circle cx="100" cy="100" r={92 * ring.outer} fill="url(#twin-core)" />
      <circle
        cx="100"
        cy="100"
        r={92 * ring.outer}
        fill="none"
        stroke="var(--primary)"
        strokeOpacity="0.35"
        strokeWidth="1"
      />
      <circle
        cx="100"
        cy="100"
        r={92 * ring.inner}
        fill="none"
        stroke="var(--ai)"
        strokeOpacity="0.5"
        strokeWidth="1.5"
        strokeDasharray="4 7"
      />
      <circle cx="100" cy="100" r={92 * ring.inner * 0.45} fill="var(--primary)" fillOpacity="0.5" />
    </svg>
  );
}
