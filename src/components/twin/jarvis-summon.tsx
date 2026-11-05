"use client";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useJarvis } from "@/components/twin/jarvis";

/**
 * The header's way in.
 *
 * The shortcut is shown on the control rather than only in a help page,
 * because a shortcut nobody is told about is a shortcut nobody uses. It is
 * hidden on small screens where there is no keyboard to press it with — the
 * button itself still works.
 */
export function JarvisSummon() {
  const { summon } = useJarvis();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={summon}
      aria-keyshortcuts="Meta+J Control+J"
      aria-label="Ask your twin"
    >
      <Sparkles aria-hidden />
      <span className="hidden sm:inline">Ask</span>
      <kbd className="text-muted-foreground ml-1 hidden rounded border px-1 text-2xs lg:inline">
        ⌘J
      </kbd>
    </Button>
  );
}
