"use client";

import { Eye, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DataUse } from "@/lib/domain/types";

/**
 * Shown before any request that would send personal context to the AI.
 *
 * It lists exactly what will be sent, in plain language, and the request only
 * happens if the user approves it. Consent is per request — approving once does
 * not grant standing access.
 */
export function ConsentSheet({
  uses,
  onApprove,
  trigger,
}: {
  uses: DataUse[];
  onApprove?: () => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Eye aria-hidden />
            What will be sent?
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="text-ai size-5" aria-hidden />
            Before this is sent
          </DialogTitle>
          <DialogDescription>
            This request needs the information below. Nothing else is included, and
            nothing is sent until you approve it.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {uses.map((use) => (
            <li key={use.label} className="bg-muted/40 rounded-lg border p-3">
              <p className="text-sm font-medium">{use.label}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">{use.detail}</p>
            </li>
          ))}
        </ul>

        <p className="text-muted-foreground text-xs">
          You can review every approval later under Privacy &amp; control, and
          withdraw it at any time.
        </p>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Not now
          </Button>
          <Button
            variant="ai"
            onClick={() => {
              onApprove?.();
              setOpen(false);
            }}
          >
            Send this and continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
