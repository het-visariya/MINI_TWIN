"use client";

import { ChevronDown, Wand2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DomainIcon } from "@/components/patterns/domain-icon";
import { StatusChip } from "@/components/patterns/status-chip";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "cn";
import type { Conflict } from "@/lib/domain/types";

/**
 * A detected cross-domain conflict and the ways out of it.
 *
 * The twin proposes; the user accepts, modifies or dismisses. Nothing in the
 * user's plan changes until they pick something.
 */
export function ConflictBanner({
  conflict,
  className,
}: {
  conflict: Conflict;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "border-risk/35 bg-risk/5 shadow-card rounded-xl border p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip kind={conflict.severity}>Time conflict</StatusChip>
            {conflict.domains.map((domain) => (
              <DomainIcon key={domain} domain={domain} withLabel />
            ))}
          </div>
          <p className="mt-2 text-sm font-medium">{conflict.summary}</p>
        </div>

        <div className="flex items-center gap-1.5">
          <CollapsibleTrigger asChild>
            <Button variant="default" size="sm">
              <Wand2 aria-hidden />
              Fix my day
              <ChevronDown
                className={cn("transition-transform", open && "rotate-180")}
                aria-hidden
              />
            </Button>
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss this conflict"
            onClick={() => setDismissed(true)}
          >
            <X aria-hidden />
          </Button>
        </div>
      </div>

      <CollapsibleContent className="mt-4 space-y-2">
        <p className="text-muted-foreground text-xs">
          Three ways to close the gap. Pick one, or change it afterwards — nothing
          moves until you choose.
        </p>
        {conflict.resolutions.map((resolution) => (
          <div
            key={resolution.id}
            className="bg-card flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{resolution.label}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">{resolution.detail}</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast.info("Opened for editing", {
                    description: "Plan editing arrives with the planning engine.",
                  })
                }
              >
                Modify
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  toast.success("Plan accepted", {
                    description: "Nothing is saved in this preview build.",
                  })
                }
              >
                Accept
              </Button>
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
