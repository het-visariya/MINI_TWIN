"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { TwinState } from "@/lib/domain/types";

type TwinStateValue = {
  state: TwinState;
  /** 0–1. How energetic the visual may be. */
  intensity: number;
  /** User preference: when false the animated twin never renders. */
  animationEnabled: boolean;
  setState: (state: TwinState) => void;
  setIntensity: (intensity: number) => void;
  setAnimationEnabled: (enabled: boolean) => void;
};

const TwinStateContext = createContext<TwinStateValue | null>(null);

/**
 * The twin's visual state is set explicitly by the app (or by the user), never
 * inferred from mood. "resting" is calm and low-energy; no state expresses
 * disappointment.
 */
export function TwinStateProvider({
  children,
  initialState = "balanced",
  initialIntensity = 0.5,
}: {
  children: ReactNode;
  initialState?: TwinState;
  initialIntensity?: number;
}) {
  const [state, setState] = useState<TwinState>(initialState);
  const [intensity, setIntensity] = useState(initialIntensity);
  const [animationEnabled, setAnimationEnabled] = useState(true);

  const clampIntensity = useCallback(
    (next: number) => setIntensity(Math.min(1, Math.max(0, next))),
    [],
  );

  const value = useMemo(
    () => ({
      state,
      intensity,
      animationEnabled,
      setState,
      setIntensity: clampIntensity,
      setAnimationEnabled,
    }),
    [state, intensity, animationEnabled, clampIntensity],
  );

  return <TwinStateContext.Provider value={value}>{children}</TwinStateContext.Provider>;
}

export function useTwinState() {
  const value = useContext(TwinStateContext);
  if (!value) {
    throw new Error("useTwinState must be used inside <TwinStateProvider>");
  }
  return value;
}

/** Human-readable description of each state, used for the accessible label. */
export const twinStateLabel: Record<TwinState, string> = {
  focused: "focused — one clear priority",
  balanced: "balanced — plan fits the day",
  stretched: "stretched — the plan asks for more time than the day has",
  resting: "resting — a lighter day by choice",
};
