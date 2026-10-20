"use client";

import {
  Dumbbell,
  GraduationCap,
  ListChecks,
  Plus,
  Salad,
  Target,
  Timer,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "cn";

const actions = [
  { id: "task", label: "Task", hint: "Title, deadline, estimate", icon: ListChecks },
  { id: "study", label: "Study session", hint: "Subject and duration", icon: GraduationCap },
  { id: "workout", label: "Workout", hint: "Exercises, sets, reps", icon: Dumbbell },
  { id: "meal", label: "Meal", hint: "Type it in words — confirm before saving", icon: Salad },
  { id: "expense", label: "Expense", hint: "Amount and category", icon: Wallet },
  { id: "goal", label: "Goal", hint: "What, by when, hours a week", icon: Target },
  { id: "focus", label: "Start focus timer", hint: "25 or 50 minutes", icon: Timer },
];

/**
 * Entry for the frequent actions in three taps or fewer: ⌘K / Ctrl-K on a
 * keyboard, a floating button on mobile.
 */
export function QuickAdd({ variant = "button" }: { variant?: "button" | "fab" }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      {variant === "button" ? (
        <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
          <Plus aria-hidden />
          <span className="hidden sm:inline">Quick add</span>
          <kbd className="text-muted-foreground bg-muted hidden rounded border px-1.5 py-0.5 text-2xs font-medium lg:inline-block">
            ⌘K
          </kbd>
        </Button>
      ) : (
        <Button
          variant="default"
          size="icon-lg"
          onClick={() => setOpen(true)}
          aria-label="Quick add"
          className={cn(
            "fixed right-4 bottom-20 z-30 rounded-full shadow-[var(--elevation-overlay)]",
            "md:hidden",
          )}
        >
          <Plus aria-hidden />
        </Button>
      )}

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Quick add"
        description="Add a task, session, meal, expense or goal"
      >
        <CommandInput placeholder="What do you want to add?" />
        <CommandList>
          <CommandEmpty>Nothing matches that yet.</CommandEmpty>
          <CommandGroup heading="Add">
            {actions.map((action) => (
              <CommandItem
                key={action.id}
                value={`${action.label} ${action.hint}`}
                onSelect={() => {
                  setOpen(false);
                  toast.info(`${action.label} form`, {
                    description: "Entry forms arrive with each module in phase 2.",
                  });
                }}
              >
                <action.icon aria-hidden />
                <span className="font-medium">{action.label}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {action.hint}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
