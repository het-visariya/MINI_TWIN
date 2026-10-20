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
    background: "#faf5ff",
    foreground: "#1e1b4b",
    card: "#ffffff",
    primary: "#7c3aed",
    ai: "#0891b2",
    muted: "#eceef9",
    mutedForeground: "#475569",
    border: "#ddd6fe",
  },
  dark: {
    background: "#0f0f23",
    foreground: "#e2e8f0",
    card: "#1a1830",
    primary: "#8b5cf6",
    ai: "#22d3ee",
    muted: "#27273b",
    mutedForeground: "#94a3b8",
    border: "#302c52",
  },
} as const satisfies Record<ThemeMode, Record<string, string>>;

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
 * Data hues. Used for chart series, Twin Pulse rings and module icons —
 * never as a second brand colour and never as the only carrier of meaning.
 */
export const domainHue: Record<Domain, Record<ThemeMode, string>> = {
  academic: { light: "#4f46e5", dark: "#818cf8" },
  productivity: { light: "#0d9488", dark: "#2dd4bf" },
  health: { light: "#0891b2", dark: "#22d3ee" },
  nutrition: { light: "#059669", dark: "#34d399" },
  finance: { light: "#0284c7", dark: "#38bdf8" },
  career: { light: "#d97706", dark: "#fbbf24" },
  goals: { light: "#7c3aed", dark: "#a78bfa" },
  routine: { light: "#64748b", dark: "#94a3b8" },
};

/** Tailwind text-colour class per domain, for component use. */
export const domainTextClass: Record<Domain, string> = {
  academic: "text-domain-academic",
  productivity: "text-domain-productivity",
  health: "text-domain-health",
  nutrition: "text-domain-nutrition",
  finance: "text-domain-finance",
  career: "text-domain-career",
  goals: "text-domain-goals",
  routine: "text-domain-routine",
};

export const STATUSES = ["ok", "attention", "risk", "overdue"] as const;
export type Status = (typeof STATUSES)[number];

/** Motion durations in ms. Mirrored as CSS variables; see presets.ts for the
 *  Motion/Framer transitions built from these. */
export const duration = {
  instant: 100,
  fast: 180,
  base: 280,
  slow: 450,
} as const;

/** The single easing curve the product uses. */
export const easeTwin = [0.22, 1, 0.36, 1] as const;

/** Stagger step for list reveals, in seconds. */
export const staggerStep = 0.06;

export const radius = { sm: 8, md: 10, lg: 12, xl: 17, "2xl": 22 } as const;
