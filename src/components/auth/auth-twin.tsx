"use client";

import { useEffect } from "react";

import { TwinVisual } from "@/components/twin/twin-visual";
import { useTwinState } from "@/components/twin/twin-state";
import { cn } from "@/lib/utils";

/**
 * The twin on the auth screens.
 *
 * It settles from `resting` into `balanced` shortly after the page appears, so
 * the first thing a new visitor sees is the figure coming together rather than
 * a static blob. It is decorative here — there is no user yet, so there is
 * nothing for it to report — which is why it carries no live state.
 */
export function AuthTwin({ compact = false }: { compact?: boolean }) {
  const { setState, setIntensity } = useTwinState();

  useEffect(() => {
    const id = window.setTimeout(() => {
      setState("balanced");
      setIntensity(0.45);
    }, 400);

    return () => window.clearTimeout(id);
  }, [setState, setIntensity]);

  return (
    <TwinVisual
      size="hero"
      className={cn(compact ? "max-w-20" : "max-w-[18rem]")}
    />
  );
}
