"use client";

import { useEffect } from "react";

import { useTwinState } from "@/components/twin/twin-state";
import type { TwinState } from "@/lib/domain/types";

/**
 * Sets the shell's twin state from the page that actually knows it.
 *
 * The shell is prerendered with a neutral state; when a screen's per-request
 * data arrives it declares the real one, so the dock avatar and the hero never
 * disagree. The state is still set explicitly — nothing is inferred here.
 */
export function TwinStateSync({
  state,
  intensity,
}: {
  state: TwinState;
  intensity: number;
}) {
  const { setState, setIntensity } = useTwinState();

  useEffect(() => {
    setState(state);
    setIntensity(intensity);
  }, [state, intensity, setState, setIntensity]);

  return null;
}
