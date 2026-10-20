"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";

import {
  revealVariants,
  staggerItemVariants,
  staggerParentVariants,
  staticVariants,
} from "@/components/motion/presets";

type DivProps = Omit<ComponentProps<typeof motion.div>, "variants">;

/**
 * Content arriving in place. With reduced motion on, the final state renders
 * immediately — the element is never hidden waiting for an animation.
 */
export function Reveal({ children, ...props }: DivProps & { children: ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial="hidden"
      animate="shown"
      variants={reduced ? staticVariants : revealVariants}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Parent for a sequence of <StaggerItem> children. */
export function Stagger({ children, ...props }: DivProps & { children: ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial="hidden"
      animate="shown"
      variants={reduced ? staticVariants : staggerParentVariants}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, ...props }: DivProps & { children: ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <motion.div variants={reduced ? staticVariants : staggerItemVariants} {...props}>
      {children}
    </motion.div>
  );
}
