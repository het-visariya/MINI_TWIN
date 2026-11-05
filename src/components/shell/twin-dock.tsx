"use client";

import { ArrowUpRight, Send } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ChatThread, TypingIndicator } from "@/components/patterns/chat-thread";
import { TwinVisual } from "@/components/twin/twin-visual";
import { twinStateLabel, useTwinState } from "@/components/twin/twin-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { allNavItems } from "@/lib/navigation";
import type { TwinMessage } from "@/lib/domain/types";

/**
 * The persistent twin. Open it from any screen and the conversation starts
 * with that screen's context, so the user is never retyping where they are.
 */
export function TwinDock({ messages }: { messages: TwinMessage[] }) {
  const [open, setOpen] = useState(false);
  const { state } = useTwinState();
  const pathname = usePathname();

  const current = allNavItems.find((item) => pathname?.startsWith(item.href));
  const context = current?.label ?? "your day";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted focus-visible:ring-ring flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 transition-colors focus-visible:ring-2"
          aria-label={`Open your twin. Currently ${twinStateLabel[state]}`}
        >
          <TwinVisual size="dock" />
          <span className="hidden text-xs font-medium sm:inline">Ask my twin</span>
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>Your twin</SheetTitle>
          <SheetDescription>
            Looking at <span className="text-foreground font-medium">{context}</span>.
            Ask about anything on this screen — it answers from your own numbers.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 py-5">
          <ChatThread messages={messages} />
          <div className="mt-4">
            <TypingIndicator />
          </div>
        </ScrollArea>

        <div className="space-y-3 border-t p-4">
          <form
            className="flex gap-2"
            onSubmit={(event) => event.preventDefault()}
            aria-label="Send a message to your twin"
          >
            <Input placeholder={`Ask about ${context.toLowerCase()}…`} />
            <Button type="submit" variant="primary" size="icon" aria-label="Send">
              <Send aria-hidden />
            </Button>
          </form>

          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-2xs">
              Not a doctor, dietitian or financial adviser.
            </p>
            <Button variant="ghost" size="sm" asChild onClick={() => setOpen(false)}>
              <Link href="/twin">
                Full conversation
                <ArrowUpRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
