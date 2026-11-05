"use client";

import { useEffect } from "react";

import { TwinFallback } from "@/components/twin/twin-fallback";
import { twinStateLabel, useTwinState } from "@/components/twin/twin-state";
import { cn } from "@/lib/utils";

/**
 * The twin on the auth screens.
 *
 * It settles from `resting` into `balanced` shortly after the page appears, so
 * the first thing a new visitor sees is the figure coming together rather than
 * a static blob. It is decorative here — there is no user yet, so there is
 * nothing for it to report — which is why it carries no live state.
 *
 * This is deliberately the SVG fallback rather than the live canvas. The auth
 * layout renders the twin twice — once in the desktop side panel and once in
 * the `lg:hidden` mobile header — and CSS hiding does not unmount a component,
 * so using the canvas here put two live WebGL contexts on one page (one of
 * them at 0x0). Only the Home hero gets a canvas; everywhere else is SVG.
 */
export function AuthTwin({ compact = false }: { compact?: boolean }) {
  const { state, setState, setIntensity } = useTwinState();

  useEffect(() => {
    const id = window.setTimeout(() => {
      setState("balanced");
      setIntensity(0.45);
    }, 400);

    return () => window.clearTimeout(id);
  }, [setState, setIntensity]);

  return (
    <div
      className={cn(
        "relative aspect-square w-full select-none",
        compact ? "max-w-20" : "max-w-[18rem]",
      )}
      data-twin-state={state}
    >
      <TwinFallback state={state} label={`Your twin: ${twinStateLabel[state]}`} />
    </div>
  );
}
