"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { TwinChat } from "@/components/twin/twin-chat";
import { TwinFallback } from "@/components/twin/twin-fallback";
import { useJarvis } from "@/components/twin/jarvis";
import { cn } from "@/lib/utils";
import type { TwinMessage, TwinState } from "@/lib/domain/types";

/**
 * Jarvis: the twin, summoned over whatever you were doing.
 *
 * Deliberately the same `TwinChat` the /twin page uses rather than a second
 * chat implementation — a question asked here and a question asked there must
 * reach the same tools, the same consent gate and the same thread, or the two
 * would drift and one of them would quietly become the worse one.
 *
 * The greeting is built from the snapshot the layout already has. No model
 * call: an overlay that costs a round trip before it can say hello is an
 * overlay people stop summoning.
 */
export function JarvisOverlay({
  greeting,
  oneThing,
  state,
  conversation,
}: {
  greeting: string;
  oneThing: string | null;
  state: TwinState;
  conversation: TwinMessage[];
}) {
  const { open, waking, dismiss } = useJarvis();
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  /* Remember what had focus, so dismissing returns the user to where they
     were rather than to the top of the document. */
  useEffect(() => {
    if (open) restoreTo.current = document.activeElement as HTMLElement | null;
    else restoreTo.current?.focus?.();
  }, [open]);

  /* Move focus into the panel once it exists. */
  useEffect(() => {
    if (!open) return;

    const first = panel.current?.querySelector<HTMLElement>(
      'textarea, button, [href], input, [tabindex]:not([tabindex="-1"])',
    );

    first?.focus();
  }, [open]);

  /*
   * Escape closes, Tab is trapped.
   *
   * Trapped rather than merely styled as modal: with `aria-modal` set, a
   * screen reader is told the rest of the page is inert, and letting Tab
   * wander out of the panel would make that a lie.
   */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }

      if (event.key !== "Tab" || !panel.current) return;

      const focusable = Array.from(
        panel.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[8vh]"
      role="presentation"
    >
      {/* The scrim. Clicking it dismisses, which is what every overlay in the
          product does and what people try first. */}
      <button
        type="button"
        aria-label="Close your twin"
        onClick={dismiss}
        className={cn(
          "bg-background/80 fixed inset-0 cursor-default backdrop-blur-sm",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200",
        )}
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Your twin"
        className={cn(
          "bg-card shadow-card relative flex w-full max-w-2xl flex-col rounded-2xl border p-4",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "size-10 shrink-0",
              /* The twin condenses as it wakes. Purely decorative, and
                 motion-safe so it is simply absent for reduced motion. */
              waking && "motion-safe:animate-pulse",
            )}
          >
            <TwinFallback state={state} label="" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-base font-medium">{greeting}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {oneThing
                ? `The one thing right now: ${oneThing}`
                : "Ask about anything in your own numbers."}
            </p>
          </div>

          <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Close">
            <X aria-hidden />
          </Button>
        </div>

        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          <TwinChat
            initialMessages={conversation}
            starters={STARTERS}
            /* Same thread as /twin, so a conversation started in the overlay
               continues on the page and the other way round. */
            threadId={new Date().toISOString().slice(0, 10)}
          />
        </div>

        <p className="text-muted-foreground mt-3 text-2xs">
          Esc closes · ⌘J reopens · answers come from your own numbers
        </p>
      </div>
    </div>
  );
}

const STARTERS = [
  "What should I do next?",
  "What happens if I skip today?",
  "Rebuild the rest of today",
];
