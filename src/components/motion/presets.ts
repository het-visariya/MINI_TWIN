import type { Transition, Variants } from "motion/react";

import { duration, easeTwin, staggerStep } from "@/lib/design/tokens";

const s = (ms: number) => ms / 1000;

/**
 * The product's four transitions. Components pick one of these; they do not
 * invent durations or easings.
 *
 *  instant — press/tap feedback
 *  fast    — hover, toggles, chips
 *  base    — cards, sheets, route changes
 *  slow    — twin state change, staggered reveals
 */
export const transition = {
  instant: { duration: s(duration.instant), ease: easeTwin },
  fast: { duration: s(duration.fast), ease: easeTwin },
  base: { duration: s(duration.base), ease: easeTwin },
  slow: { duration: s(duration.slow), ease: easeTwin },
} as const satisfies Record<string, Transition>;

/** Content arriving in place. Used by <Reveal>. */
export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0, transition: transition.base },
};

/** Parent of a list whose children reveal in sequence. Used by <Stagger>. */
export const staggerParentVariants: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: staggerStep } },
};

/** A single list item. No overshoot — this is informational UI. */
export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  shown: { opacity: 1, y: 0, transition: transition.base },
};

/** Sheets, popovers and dialogs that grow from their trigger. */
export const overlayVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  shown: { opacity: 1, scale: 1, transition: transition.base },
  exit: { opacity: 0, scale: 0.97, transition: transition.fast },
};

/** The twin changing state. The only deliberately slow motion in the app. */
export const twinStateTransition = transition.slow;

/**
 * Final-state variants, returned in place of the animated ones when the user
 * prefers reduced motion. Content appears; nothing moves.
 */
export const staticVariants: Variants = {
  hidden: { opacity: 1, y: 0, scale: 1 },
  shown: { opacity: 1, y: 0, scale: 1, transition: { duration: 0 } },
  exit: { opacity: 1, transition: { duration: 0 } },
};

/** Press feedback used by interactive cards and chips. */
export const pressable = {
  whileHover: { y: -2 },
  whileTap: { y: 0, scale: 0.995 },
  transition: transition.fast,
} as const;
