"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ActionResult } from "@/lib/validation/shared";

/**
 * Delete one row, with a confirmation step.
 *
 * A plain `<form action={serverAction}>` would be shorter, but a form action
 * has to return void — so a failure could only be reported by throwing, which
 * replaces the page with an error boundary over a failed delete. This reports
 * it as a toast and leaves the page alone.
 *
 * The confirmation is a popover rather than `window.confirm`: a native dialog
 * blocks the whole tab, and these are small, recoverable deletions of the
 * user's own rows, not account closure.
 */
export function DeleteButton({
  action,
  /** The field name the action reads the id from. */
  name,
  id,
  label,
  description = "This cannot be undone.",
  className,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  name: string;
  id: string;
  /** For the accessible name, e.g. "the workout on 21 Oct". */
  label: string;
  description?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set(name, id);

      const result = await action(formData);

      if (result.ok) {
        setOpen(false);
        toast.success("Deleted.");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Delete ${label}`}
          className={className}
        >
          <Trash2 aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <p className="text-sm font-medium">Delete {label}?</p>
        <p className="text-muted-foreground mt-1 text-xs">{description}</p>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={remove}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Keep
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
