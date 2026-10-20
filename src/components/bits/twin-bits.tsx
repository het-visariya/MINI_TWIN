"use client";

import type { ComponentProps, ReactNode } from "react";

import BitsAnimatedContent from "@/components/bits/AnimatedContent";
import BitsBlurText from "@/components/bits/BlurText";
import BitsCountUp from "@/components/bits/CountUp";
import BitsDecryptedText from "@/components/bits/DecryptedText";
import BitsDotGrid from "@/components/bits/DotGrid";
import BitsFadeContent from "@/components/bits/FadeContent";
import BitsOrb from "@/components/bits/Orb";
import BitsRotatingText from "@/components/bits/RotatingText";
import BitsSpotlightCard from "@/components/bits/SpotlightCard";
import BitsStarBorder from "@/components/bits/StarBorder";
import { useBitsTheme } from "@/components/bits/use-bits-theme";
import { cn } from "cn";

/**
 * The curated React Bits set, wrapped once.
 *
 * Every wrapper does two things the raw components do not: it takes its
 * colours from the design tokens rather than from the demo palette, and it
 * renders the static end state when the user prefers reduced motion. Screens
 * import from here, never from the vendor files directly.
 */

/** Spotlight tint for cards, per the design spec. */
const SPOTLIGHT = "rgba(212, 242, 90, 0.06)";
const SPOTLIGHT_LIGHT = "rgba(88, 116, 0, 0.07)";

export function BlurText({
  text,
  className,
  ...props
}: ComponentProps<typeof BitsBlurText>) {
  const { reduced } = useBitsTheme();

  if (reduced) return <span className={className}>{text}</span>;

  return (
    <BitsBlurText
      text={text}
      className={className}
      animateBy="words"
      direction="bottom"
      trigger="view"
      loop={false}
      stepDuration={0.35}
      {...props}
    />
  );
}

export function RotatingText({
  texts,
  ...props
}: ComponentProps<typeof BitsRotatingText>) {
  const { reduced } = useBitsTheme();

  /* Reduced motion gets the first phrase, held. A rotating list of words is
     the one thing on the landing page that cannot be expressed statically. */
  if (reduced) return <span>{texts[0]}</span>;

  return (
    <BitsRotatingText
      texts={texts}
      highlight={false}
      rotationInterval={2600}
      staggerDuration={0.015}
      {...props}
    />
  );
}

export function CountUp({ to, ...props }: ComponentProps<typeof BitsCountUp>) {
  const { reduced } = useBitsTheme();

  if (reduced) {
    return (
      <span className={props.className} data-slot="metric">
        {props.prefix}
        {to}
        {props.suffix}
      </span>
    );
  }

  return (
    <BitsCountUp
      to={to}
      duration={1.1}
      trigger="view"
      replayOnHover={false}
      {...props}
    />
  );
}

export function SpotlightCard({
  children,
  className,
  ...props
}: ComponentProps<typeof BitsSpotlightCard>) {
  const { mode, reduced } = useBitsTheme();

  const shell = cn(
    "bg-card text-card-foreground rounded-xl border p-5",
    "transition-colors hover:border-border-strong",
    className,
  );

  /* The spotlight is a hover affordance, not information. Without it the card
     is still a card. */
  if (reduced) {
    return (
      <div className={shell} {...props}>
        {children}
      </div>
    );
  }

  return (
    <BitsSpotlightCard
      className={shell}
      theme={mode}
      spotlightColor={mode === "light" ? SPOTLIGHT_LIGHT : SPOTLIGHT}
      borderGlow={0.35}
      flare={false}
      grain={0}
      {...props}
    >
      {children}
    </BitsSpotlightCard>
  );
}

export function AnimatedContent({
  children,
  ...props
}: ComponentProps<typeof BitsAnimatedContent>) {
  const { reduced } = useBitsTheme();

  if (reduced) return <div className={props.className}>{children}</div>;

  /* The product's one entrance language: 12px rise, 300ms, 40ms stagger. */
  return (
    <BitsAnimatedContent
      distance={12}
      direction="vertical"
      duration={0.3}
      stagger={0.04}
      initialOpacity={0}
      animateOpacity
      blur={0}
      tilt={0}
      scale={1}
      trigger="scroll"
      once
      {...props}
    >
      {children}
    </BitsAnimatedContent>
  );
}

export function FadeContent({
  children,
  ...props
}: ComponentProps<typeof BitsFadeContent>) {
  const { reduced } = useBitsTheme();

  if (reduced) return <div className={props.className}>{children}</div>;

  return (
    <BitsFadeContent duration={0.3} blur={false} once {...props}>
      {children}
    </BitsFadeContent>
  );
}

export function StarBorder({
  children,
  ...props
}: ComponentProps<typeof BitsStarBorder>) {
  const { mode, colors, reduced } = useBitsTheme();

  return (
    <BitsStarBorder
      theme={mode}
      color={colors.accent}
      trailColor={colors.accent}
      backgroundColor={colors.accent}
      textColor={colors.accentForeground}
      /* Slow, and the only decorated button on the whole site. */
      duration={reduced ? 0 : 7}
      sparkle={!reduced}
      stars={reduced ? 0 : 3}
      glow={0.4}
      thickness={1}
      radius={999}
      {...props}
    >
      {children}
    </BitsStarBorder>
  );
}

export function DecryptedText({
  text,
  ...props
}: ComponentProps<typeof BitsDecryptedText>) {
  const { colors, reduced } = useBitsTheme();

  if (reduced) return <span className={props.className}>{text}</span>;

  return (
    <BitsDecryptedText
      text={text}
      animateOn="view"
      sequential
      revealDirection="start"
      speed={28}
      scrambleColor={colors.mutedForeground}
      loop={false}
      {...props}
    />
  );
}

/** Landing background texture. Grey at rest, accent near the cursor. */
export function DotGrid(props: ComponentProps<typeof BitsDotGrid>) {
  const { colors, reduced } = useBitsTheme();

  return (
    <BitsDotGrid
      dotSize={2}
      gap={28}
      baseColor={colors.border}
      activeColor={colors.accent}
      proximity={110}
      opacity={0.1}
      glow={0}
      mouseInteraction={!reduced}
      clickShock={false}
      paused={reduced}
      {...props}
    />
  );
}

/** The "awake" twin in Jarvis mode. Voice-reactive; see §8 of the spec. */
export function Orb({
  level = 0,
  ...props
}: ComponentProps<typeof BitsOrb> & {
  /** 0–1 microphone or speech amplitude, drives the orb's intensity. */
  level?: number;
}) {
  const { colors, reduced } = useBitsTheme();

  return (
    <BitsOrb
      colors={[colors.accent, colors.foreground, colors.mutedForeground]}
      backgroundColor="transparent"
      hoverIntensity={0.18}
      rotateOnHover={false}
      followCursor={false}
      clickPulse={false}
      speed={reduced ? 0 : 0.6 + level * 1.4}
      glow={0.35 + level * 0.5}
      wobble={reduced ? 0 : 0.2 + level * 0.6}
      paused={reduced}
      dpr={1.5}
      {...props}
    />
  );
}

/**
 * Re-exported unchanged because they are structural, not decorative: the
 * wizard and the notification list carry their own reduced-motion handling
 * through the `animation`/`disableAnimations` props their screens pass.
 */
export { default as Stepper, Step } from "@/components/bits/Stepper";
export { default as AnimatedList } from "@/components/bits/AnimatedList";
export { default as MagicBento } from "@/components/bits/MagicBento";

export type BitsChildren = { children?: ReactNode };
