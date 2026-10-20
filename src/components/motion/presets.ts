import type { Transition, Variants } from "motion/react";

import { duration, easeExit, easeTwin, springLayout, staggerStep } from "@/lib/design/tokens";

const s = (ms: number) => ms / 1000;

/**
 * The product's three transitions. Components pick one of these; they do not
 * invent durations or easings.
 *
 *  fast — hover, toggles, chips, press feedback
 *  base — cards, sheets, route changes
 *  slow — twin state change, staggered reveals
 */
export const transition = {
  fast: { duration: s(duration.fast), ease: easeTwin },
  base: { duration: s(duration.base), ease: easeTwin },
  slow: { duration: s(duration.slow), ease: easeTwin },
} as const satisfies Record<string, Transition>;

/** Things leave faster than they arrive, on a sharper curve. */
export const exitTransition = {
  duration: s(duration.fast),
  ease: easeExit,
} satisfies Transition;

/**
 * The one spring. Used for `layout` animations — most visibly when the
 * priority engine re-ranks tasks and rows slide into their new order.
 */
export const layoutTransition = {
  type: "spring",
  ...springLayout,
} satisfies Transition;

/** Content arriving in place. Used by <Reveal>. 12px rise, 250ms. */
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
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0, transition: transition.base },
};

/** Sheets, popovers and dialogs that grow from their trigger. */
export const overlayVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  shown: { opacity: 1, scale: 1, transition: transition.base },
  exit: { opacity: 0, scale: 0.97, transition: exitTransition },
};

/** Route changes: a 200ms cross-fade with an 8px rise. No page slides. */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.2, ease: easeTwin } },
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
