"use client";

import {
  ArrowLeft,
  Droplet,
  Dumbbell,
  GraduationCap,
  ListChecks,
  Plus,
  Salad,
  SmilePlus,
  Target,
  Timer,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { logWater, logWorkout, saveMoodCheckin } from "@/app/(app)/health/actions";
import { logMeal } from "@/app/(app)/nutrition/actions";
import { addExpense } from "@/app/(app)/finance/actions";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { EXPENSE_CATEGORIES } from "@/lib/domain/calc/finance";
import type { ActionResult } from "@/lib/validation/shared";

/**
 * The frequent actions, in three taps or fewer.
 *
 * ⌘K / Ctrl-K on a keyboard, a floating button on mobile. Choosing an entry
 * either saves immediately (water) or swaps the list for the smallest possible
 * form; the ones that genuinely need a full screen navigate there instead of
 * pretending to fit in a palette.
 *
 * Every form here posts to the same server action its module's own screen
 * uses, so a quick-added expense is indistinguishable from one added on the
 * Finance page — and demo mode no-ops both the same way.
 */

type Mode =
  | "menu"
  | "expense"
  | "meal"
  | "workout"
  | "checkin";

const ENTRIES: {
  id: Mode | "task" | "study" | "goal" | "focus" | "water";
  label: string;
  hint: string;
  icon: typeof ListChecks;
}[] = [
  { id: "expense", label: "Expense", hint: "Amount and category", icon: Wallet },
  { id: "water", label: "Water", hint: "+250 ml, saves straight away", icon: Droplet },
  { id: "meal", label: "Meal", hint: "Type it in words", icon: Salad },
  { id: "workout", label: "Workout", hint: "One set, then add more", icon: Dumbbell },
  { id: "checkin", label: "Check-in", hint: "Mood and energy", icon: SmilePlus },
  { id: "task", label: "Task", hint: "Opens Productivity", icon: ListChecks },
  { id: "study", label: "Study session", hint: "Opens Academic", icon: GraduationCap },
  { id: "goal", label: "Goal", hint: "Opens Goals", icon: Target },
  { id: "focus", label: "Focus timer", hint: "Opens Productivity", icon: Timer },
];

export function QuickAdd({ variant = "button" }: { variant?: "button" | "fab" }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

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

  /* Always reopen on the menu: a palette that remembers the last form is a
     palette that surprises you. Reset on the close itself rather than in an
     effect watching `open`, which would be a second render for no reason. */
  const setOpenAndReset = (next: boolean) => {
    setOpen(next);
    if (!next) setMode("menu");
  };

  const close = () => setOpenAndReset(false);

  /** Today, computed in the browser — this is a client component either way. */
  const today = isoToday();

  const run = (action: () => Promise<ActionResult<unknown>>, success: string) =>
    startTransition(async () => {
      const result = await action();

      if (result.ok) {
        toast.success(success);
        close();
      } else {
        toast.error(result.error);
      }
    });

  const select = (id: (typeof ENTRIES)[number]["id"]) => {
    switch (id) {
      case "water": {
        /* The one true one-tap entry: no form at all. */
        const formData = new FormData();
        formData.set("date", today);
        formData.set("ml", "250");
        run(() => logWater(formData), "250 ml logged.");
        return;
      }
      case "task":
      case "focus":
        close();
        router.push("/productivity");
        return;
      case "study":
        close();
        router.push("/academic");
        return;
      case "goal":
        close();
        router.push("/goals");
        return;
      default:
        setMode(id as Mode);
    }
  };

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
          variant="primary"
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
        onOpenChange={setOpenAndReset}
        title="Quick add"
        description="Add a meal, expense, workout or check-in"
      >
        {mode === "menu" ? (
          <>
            <CommandInput placeholder="What do you want to add?" />
            <CommandList>
              <CommandEmpty>Nothing matches that yet.</CommandEmpty>
              <CommandGroup heading="Add">
                {ENTRIES.map((entry) => (
                  <CommandItem
                    key={entry.id}
                    value={`${entry.label} ${entry.hint}`}
                    disabled={pending}
                    onSelect={() => select(entry.id)}
                  >
                    <entry.icon aria-hidden />
                    <span className="font-medium">{entry.label}</span>
                    <span className="text-muted-foreground ml-auto text-xs">
                      {entry.hint}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </>
        ) : (
          <div className="p-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode("menu")}
              className="-ml-2 mb-2"
            >
              <ArrowLeft aria-hidden />
              Back
            </Button>

            {mode === "expense" && (
              <ExpenseQuick today={today} pending={pending} run={run} />
            )}
            {mode === "meal" && <MealQuick today={today} pending={pending} run={run} />}
            {mode === "workout" && (
              <WorkoutQuick today={today} pending={pending} run={run} />
            )}
            {mode === "checkin" && (
              <CheckinQuick today={today} pending={pending} run={run} />
            )}
          </div>
        )}
      </CommandDialog>
    </>
  );
}

type Runner = (
  action: () => Promise<ActionResult<unknown>>,
  success: string,
) => void;

/* -------------------------------------------------------------------------- */
/*                                  expense                                   */
/* -------------------------------------------------------------------------- */

function ExpenseQuick({
  today,
  pending,
  run,
}: {
  today: string;
  pending: boolean;
  run: Runner;
}) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");

  const submit = () => {
    const formData = new FormData();
    formData.set("date", today);
    formData.set("amountMinor", amount);
    formData.set("category", category);
    formData.set("paymentMethod", "UPI");

    run(() => addExpense(formData), "Expense added.");
  };

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="qa-amount" className="text-xs">
          Amount (₹)
        </Label>
        <Input
          id="qa-amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="250"
          autoFocus
        />
      </div>

      <fieldset>
        <legend className="text-xs font-medium">Category</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {EXPENSE_CATEGORIES.map((option) => (
            <Button
              key={option}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={category === option}
              onClick={() => setCategory(option)}
              className={cn(
                category === option && "border-accent/50 bg-accent/10 text-accent",
              )}
            >
              {option}
            </Button>
          ))}
        </div>
      </fieldset>

      <Button
        type="button"
        variant="primary"
        disabled={pending || amount.trim() === ""}
        onClick={submit}
      >
        {pending ? "Saving…" : "Add expense"}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    meal                                    */
/* -------------------------------------------------------------------------- */

/**
 * The quick meal entry sends one unmatched item carrying the typed text.
 *
 * It deliberately does **not** parse here. The Nutrition screen shows a draft
 * and lets the user confirm the match before anything saves; doing a silent
 * match from a palette would be the one place in the product where a guessed
 * macro lands without being seen. So this saves the words, marked as an
 * estimate, and the user can open it later.
 */
function MealQuick({
  today,
  pending,
  run,
}: {
  today: string;
  pending: boolean;
  run: Runner;
}) {
  const [text, setText] = useState("");
  const [mealType, setMealType] = useState(nearestMealType());

  const submit = () => {
    const formData = new FormData();
    formData.set("date", today);
    formData.set("mealType", mealType);
    formData.append("label", text.trim());
    formData.append("quantity", "1");
    formData.append("kcal", "0");
    formData.append("proteinG", "0");
    formData.append("carbsG", "0");
    formData.append("fatG", "0");
    formData.append("isEstimate", "true");

    run(() => logMeal(formData), "Saved. Open Nutrition to add the details.");
  };

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="qa-meal" className="text-xs">
          What did you eat?
        </Label>
        <Input
          id="qa-meal"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="2 rotis and dal"
          autoFocus
        />
        <p className="text-muted-foreground mt-1 text-2xs">
          Saved as your own words, marked an estimate. Open Nutrition to match it to the
          food table — nothing is guessed for you here.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["BREAKFAST", "LUNCH", "SNACK", "DINNER"] as const).map((option) => (
          <Button
            key={option}
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={mealType === option}
            onClick={() => setMealType(option)}
            className={cn(
              mealType === option && "border-accent/50 bg-accent/10 text-accent",
            )}
          >
            {option.charAt(0) + option.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>

      <Button
        type="button"
        variant="primary"
        disabled={pending || text.trim() === ""}
        onClick={submit}
      >
        {pending ? "Saving…" : "Log meal"}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  workout                                   */
/* -------------------------------------------------------------------------- */

function WorkoutQuick({
  today,
  pending,
  run,
}: {
  today: string;
  pending: boolean;
  run: Runner;
}) {
  const [exercise, setExercise] = useState("");
  const [reps, setReps] = useState("8");
  const [weight, setWeight] = useState("20");
  const [sets, setSets] = useState("3");

  const submit = () => {
    const formData = new FormData();
    formData.set("date", today);

    /* The same exercise repeated, which is what a quick entry means by
       "3 sets of 8" — the full logger is there for mixed sessions. */
    const count = Math.max(1, Math.min(10, Number(sets) || 1));
    for (let index = 0; index < count; index += 1) {
      formData.append("exercise", exercise);
      formData.append("reps", reps);
      formData.append("weightKg", weight);
    }

    run(() => logWorkout(formData), "Workout saved.");
  };

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="qa-exercise" className="text-xs">
          Exercise
        </Label>
        <Input
          id="qa-exercise"
          value={exercise}
          onChange={(event) => setExercise(event.target.value)}
          placeholder="Squat"
          autoFocus
        />
      </div>

      <div className="flex gap-2">
        {(
          [
            ["Sets", sets, setSets],
            ["Reps", reps, setReps],
            ["Weight (kg)", weight, setWeight],
          ] as const
        ).map(([label, value, set]) => (
          <div key={label} className="flex-1">
            <Label htmlFor={`qa-${label}`} className="text-2xs">
              {label}
            </Label>
            <Input
              id={`qa-${label}`}
              value={value}
              onChange={(event) => set(event.target.value)}
              inputMode="decimal"
              className="tabular font-mono"
            />
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="primary"
        disabled={pending || exercise.trim() === ""}
        onClick={submit}
      >
        {pending ? "Saving…" : "Save workout"}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  check-in                                  */
/* -------------------------------------------------------------------------- */

function CheckinQuick({
  today,
  pending,
  run,
}: {
  today: string;
  pending: boolean;
  run: Runner;
}) {
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);

  const submit = (nextMood: number, nextEnergy: number) => {
    const formData = new FormData();
    formData.set("date", today);
    formData.set("mood", String(nextMood));
    formData.set("energy", String(nextEnergy));

    run(() => saveMoodCheckin(formData), "Check-in saved.");
  };

  const pick = (which: "mood" | "energy", value: number) => {
    const nextMood = which === "mood" ? value : mood;
    const nextEnergy = which === "energy" ? value : energy;

    if (which === "mood") setMood(value);
    else setEnergy(value);

    /* Saves itself the moment both are chosen — two taps, as promised. */
    if (nextMood !== null && nextEnergy !== null) submit(nextMood, nextEnergy);
  };

  return (
    <div className="space-y-3">
      {(
        [
          ["Mood", mood, "mood"],
          ["Energy", energy, "energy"],
        ] as const
      ).map(([label, value, key]) => (
        <fieldset key={key}>
          <legend className="text-xs font-medium">{label}</legend>
          <div className="mt-1.5 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((step) => (
              <Button
                key={step}
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                aria-pressed={value === step}
                onClick={() => pick(key, step)}
                className={cn(
                  "tabular flex-1 font-mono",
                  value === step && "border-accent/50 bg-accent/10 text-accent",
                )}
              >
                {step}
              </Button>
            ))}
          </div>
        </fieldset>
      ))}

      <p className="text-muted-foreground text-2xs">
        Saves as soon as both are picked. One entry a day — coming back edits it.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   shared                                   */
/* -------------------------------------------------------------------------- */

function isoToday(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function nearestMealType(): "BREAKFAST" | "LUNCH" | "SNACK" | "DINNER" {
  const hour = new Date().getHours();
  if (hour < 11) return "BREAKFAST";
  if (hour < 16) return "LUNCH";
  if (hour < 19) return "SNACK";
  return "DINNER";
}
