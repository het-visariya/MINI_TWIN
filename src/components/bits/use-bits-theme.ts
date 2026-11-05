"use client";

import { useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";

import { palette } from "@/lib/design/tokens";

/**
 * React Bits components take colours as plain strings because they paint to
 * canvas, so they cannot read CSS custom properties. This is the one place
 * that resolves the current theme into those strings — every wrapper in
 * twin-bits.tsx goes through it, and no demo colour is ever passed through.
 */
export function useBitsTheme() {
  const { resolvedTheme } = useTheme();
  const reduced = useReducedMotion() ?? false;
  const mode = resolvedTheme === "light" ? "light" : "dark";

  return { mode, reduced, colors: palette[mode] } as const;
}
