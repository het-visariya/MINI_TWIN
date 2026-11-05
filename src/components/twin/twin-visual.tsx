"use client";

import { useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { TwinFallback } from "@/components/twin/twin-fallback";
import { twinStateLabel, useTwinState } from "@/components/twin/twin-state";
import { cn } from "@/lib/utils";

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

    /* Also paused while Jarvis is open. The overlay covers the hero anyway,
       and two things animating behind a backdrop-blur is the one combination
       that makes a mid-range laptop audible. The flag is an attribute on
       <html> rather than a prop, because this component is dynamically
       imported several levels below whatever opened the overlay. */
    const jarvisOpen = () =>
      document.documentElement.hasAttribute("data-jarvis-open");

    const sync = () => setActive(visible && !document.hidden && !jarvisOpen());

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.05 },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);

    /* The attribute is toggled by JarvisProvider, so the canvas learns about
       it the same way it learns about tab visibility: by being told. */
    const attributes = new MutationObserver(sync);
    attributes.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-jarvis-open"],
    });

    return () => {
      observer.disconnect();
      attributes.disconnect();
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

  /* Called unconditionally — the dock's exclusion is applied to the result,
     not to the call, so the hook order never changes between renders. */
  const canvasCapable = useCanvasAllowed(animationEnabled);
  const active = useFrameLoopActive(container) && !paused;

  /*
   * One WebGL context on screen, ever.
   *
   * The dock sits in the app shell header, so it is present on every
   * authenticated page — including Home, which renders the hero twin. Two
   * canvases then mount at once and the second gets a context the browser may
   * refuse or evict, which is what renders as a flat white square.
   *
   * So the dock is never a canvas. It is a 36px avatar: the particle figure is
   * indistinguishable from the SVG at that size, and the SVG costs nothing.
   */
  const canvasAllowed = size !== "dock" && canvasCapable && !paused;

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
