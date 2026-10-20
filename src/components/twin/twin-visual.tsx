"use client";

import { useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { TwinFallback } from "@/components/twin/twin-fallback";
import { twinStateLabel, useTwinState } from "@/components/twin/twin-state";
import { cn } from "cn";

const TwinScene = dynamic(() => import("@/components/twin/twin-scene"), {
  ssr: false,
  loading: () => null,
});

/** Does this device/connection/preference get the animated twin at all? */
function useCanvasAllowed(enabled: boolean) {
  const reduced = useReducedMotion();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // Every path below defers to a frame callback: probing WebGL needs the
    // DOM, and setting state straight from the effect body would cascade a
    // second render on every mount.
    if (!enabled || reduced) {
      const id = requestAnimationFrame(() => setAllowed(false));
      return () => cancelAnimationFrame(id);
    }

    const evaluate = () => {
      const wideEnough = window.matchMedia("(min-width: 768px)").matches;
      const pointerFine = window.matchMedia("(pointer: fine)").matches;

      const connection = (
        navigator as Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string };
        }
      ).connection;
      const metered =
        connection?.saveData === true ||
        /2g|slow-2g/.test(connection?.effectiveType ?? "");

      let webgl = false;
      try {
        const canvas = document.createElement("canvas");
        webgl = Boolean(
          canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
        );
      } catch {
        webgl = false;
      }

      setAllowed(webgl && !metered && (wideEnough || pointerFine));
    };

    const frame = requestAnimationFrame(evaluate);
    const media = window.matchMedia("(min-width: 768px)");
    media.addEventListener("change", evaluate);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", evaluate);
    };
  }, [enabled, reduced]);

  return allowed;
}

/** Pauses the frame loop when the twin scrolls away or the tab is hidden. */
function useFrameLoopActive(ref: React.RefObject<HTMLDivElement | null>) {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let visible = true;
    const sync = () => setActive(visible && !document.hidden);

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.05 },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [ref]);

  return active;
}

export function TwinVisual({
  size = "hero",
  /** Twin Pulse ring index 0-4 to highlight on the figure, or -1 for none. */
  highlightBand = -1,
  /** Set while Jarvis is open: only one WebGL context runs at a time. */
  paused = false,
  onSelect,
  className,
}: {
  /** "hero" on the Twin screen, "dock" for the persistent shell avatar. */
  size?: "hero" | "dock";
  highlightBand?: number;
  paused?: boolean;
  onSelect?: () => void;
  className?: string;
}) {
  const { state, intensity, animationEnabled } = useTwinState();
  const container = useRef<HTMLDivElement>(null);
  const canvasAllowed = useCanvasAllowed(animationEnabled) && !paused;
  const active = useFrameLoopActive(container) && !paused;

  const label = `Your twin: ${twinStateLabel[state]}`;

  return (
    <div
      ref={container}
      className={cn(
        "relative isolate aspect-square select-none",
        size === "hero" ? "w-full max-w-[15rem]" : "size-9",
        className,
      )}
      // Space is reserved by aspect-square, so swapping canvas for fallback
      // never shifts the layout.
      data-twin-state={state}
    >
      {canvasAllowed ? (
        <>
          <TwinScene
            state={state}
            intensity={intensity}
            active={active}
            highlightBand={highlightBand}
            onSelect={onSelect}
          />
          <span className="sr-only">{label}</span>
        </>
      ) : (
        <TwinFallback state={state} label={label} />
      )}
    </div>
  );
}
