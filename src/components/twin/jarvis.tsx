"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Who may open Jarvis, and whether it is open.
 *
 * A context rather than prop-drilling because the things that summon it are
 * scattered: a hotkey listener at the root, the twin in the header, the
 * centre button of the mobile nav, and anything added later. They all need
 * the same switch, and none of them should have to know where the overlay
 * lives in the tree.
 */
type JarvisContextValue = {
  open: boolean;
  /** True for the ~700ms wake, so the page can dim before the panel lands. */
  waking: boolean;
  summon: () => void;
  dismiss: () => void;
  toggle: () => void;
};

const JarvisContext = createContext<JarvisContextValue | null>(null);

/** Long enough to read as a deliberate wake, short enough not to be a wait. */
const WAKE_MS = 700;

export function useJarvis(): JarvisContextValue {
  const context = useContext(JarvisContext);

  if (!context) {
    /* A summon button rendered outside the provider would silently do
       nothing, which is worse than a clear failure during development. */
    throw new Error("useJarvis must be used inside <JarvisProvider>.");
  }

  return context;
}

export function JarvisProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [waking, setWaking] = useState(false);

  const summon = useCallback(() => {
    setOpen((already) => {
      if (already) return already;

      /* Reduced motion gets the panel immediately. The wake is a flourish,
         and a flourish that someone has asked their system to suppress is
         just a delay. */
      const instant =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!instant) {
        setWaking(true);
        window.setTimeout(() => setWaking(false), WAKE_MS);
      }

      return true;
    });
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    setWaking(false);
  }, []);

  const toggle = useCallback(() => {
    setOpen((already) => {
      if (already) {
        setWaking(false);
        return false;
      }

      return true;
    });
  }, []);

  /*
   * The summon hotkey.
   *
   * ⌘J / Ctrl+J, deliberately not ⌘K — that is Quick Add, and two overlays on
   * one chord is how you teach people not to trust either. Typing is left
   * alone: a chord with a modifier cannot be produced by ordinary typing, so
   * no guard against input focus is needed, but `preventDefault` is, because
   * Ctrl+J is the browser's downloads panel on Windows.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "j" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggle();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  /*
   * The Home twin's WebGL canvas pauses while the overlay is up.
   *
   * Set as an attribute on <html> rather than passed through context because
   * the canvas decides for itself whether to run, several levels away and
   * behind a dynamic import. An attribute is readable from anywhere without
   * threading a prop through components that do not care.
   */
  useEffect(() => {
    const root = document.documentElement;

    if (open) root.setAttribute("data-jarvis-open", "true");
    else root.removeAttribute("data-jarvis-open");

    return () => root.removeAttribute("data-jarvis-open");
  }, [open]);

  /* The page behind must not scroll under the overlay. */
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const value = useMemo(
    () => ({ open, waking, summon, dismiss, toggle }),
    [open, waking, summon, dismiss, toggle],
  );

  return <JarvisContext.Provider value={value}>{children}</JarvisContext.Provider>;
}
