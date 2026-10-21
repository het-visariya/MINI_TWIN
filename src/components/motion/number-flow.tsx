"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { duration, easeTwin } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

type NumberFlowProps = {
  value: number;
  /** Decimal places to render. */
  precision?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
};

/**
 * A number that counts to its new value instead of snapping, so a score
 * change reads as a change. Tabular numerals keep the width stable; with
 * reduced motion on, the value simply updates.
 */
export function NumberFlow({
  value,
  precision = 0,
  prefix,
  suffix,
  className,
}: NumberFlowProps) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    if (reduced) {
      previous.current = value;
      const id = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(id);
    }

    const controls = animate(previous.current, value, {
      duration: duration.slow / 1000,
      ease: easeTwin,
      onUpdate: (latest) => setDisplay(latest),
      onComplete: () => {
        previous.current = value;
      },
    });

    return () => controls.stop();
  }, [value, reduced]);

  return (
    <span className={cn("tabular", className)} data-slot="metric">
      {prefix}
      {display.toFixed(precision)}
      {suffix}
    </span>
  );
}
