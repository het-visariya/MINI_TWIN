/**
 * TypeScript mirror of the CSS tokens in src/app/globals.css.
 *
 * Only code that cannot read CSS custom properties should import from here:
 * the React Three Fiber scene (shader uniforms, lights) and chart/canvas code.
 * Components style themselves with Tailwind classes bound to the same tokens.
 */

export type ThemeMode = "light" | "dark";

export const palette = {
  light: {
    background: "#FAFAF8",
    foreground: "#0A0A0A",
    surface1: "#FFFFFF",
    surface2: "#F2F2EF",
    border: "#E6E6E1",
    muted: "#F2F2EF",
    mutedForeground: "#5F5F5A",
    accent: "#587400",
    accentForeground: "#FFFFFF",
    /* Particle colours for the twin: warm neutral body, accent highlights. */
    particle: "#2E2E2B",
    particleAccent: "#587400",
  },
  dark: {
    background: "#000000",
    foreground: "#EDEDEA",
    surface1: "#0B0B0B",
    surface2: "#141414",
    border: "#1F1F1F",
    muted: "#141414",
    mutedForeground: "#8A8A85",
    accent: "#D4F25A",
    accentForeground: "#0A0A0A",
    particle: "#EDEDEA",
    particleAccent: "#D4F25A",
  },
} as const satisfies Record<ThemeMode, Record<string, string>>;

/**
 * Chart greys, darkest to lightest. The accent is reserved for the "you"
 * series; everything a number is compared against uses these.
 */
export const chartGrey = {
  light: ["#0A0A0A", "#5F5F5A", "#B4B4AE"],
  dark: ["#EDEDEA", "#8A8A85", "#4A4A47"],
} as const satisfies Record<ThemeMode, readonly string[]>;

/** Life domains the twin reasons across. Order is the display order. */
export const DOMAINS = [
  "academic",
  "productivity",
  "health",
  "nutrition",
  "finance",
  "career",
  "goals",
  "routine",
] as const;

export type Domain = (typeof DOMAINS)[number];

/**
 * The five scores that make up Twin Pulse, in ring order. Each maps to one
 * band on the twin figure, so tapping a ring can highlight its band.
 */
export const PULSE_DOMAINS = [
  "academic",
  "health",
  "productivity",
  "career",
  "routine",
] as const satisfies readonly Domain[];

export type PulseDomain = (typeof PULSE_DOMAINS)[number];

export const STATUSES = ["ok", "attention", "risk", "overdue"] as const;
export type Status = (typeof STATUSES)[number];

/** Motion durations in ms. Mirrored as CSS variables; see presets.ts. */
export const duration = {
  fast: 150,
  base: 250,
  slow: 450,
} as const;

/** Enter easing (out-quint) — the curve the product moves on. */
export const easeTwin = [0.22, 1, 0.36, 1] as const;

/** Exit easing. Things leave faster than they arrive. */
export const easeExit = [0.4, 0, 1, 1] as const;

/** The one spring, used for layout changes such as list re-ranking. */
export const springLayout = { stiffness: 380, damping: 32 } as const;

/** Stagger step for list reveals, in seconds. */
export const staggerStep = 0.04;

export const radius = { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 } as const;
