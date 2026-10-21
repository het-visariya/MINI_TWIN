"use client";

import { Droplet } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { ProgressRing } from "@/components/patterns/charts";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/validation/shared";

/** The two amounts worth a dedicated button: a glass and a bottle. */
const QUICK_AMOUNTS = [250, 500] as const;

/**
 * Water, logged in one tap.
 *
 * Optimistic: the ring moves the instant the button is pressed rather than
 * after the round trip, because the whole point of a one-tap log is that it
 * feels like one tap. If the write fails the optimistic value is dropped on
 * the next render and a toast explains why.
 *
 * The target is a range, not a number, and is labelled an estimate — bodyweight
 * is a weak predictor of how much water somebody needs, and the UI should not
 * imply otherwise.
 */
export function WaterLog({
  action,
  today,
  todayMl,
  target,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  today: string;
  todayMl: number;
  target: { minMl: number; maxMl: number; isEstimate: true; source: string } | null;
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticMl, addOptimistic] = useOptimistic(
    todayMl,
    (current: number, added: number) => current + added,
  );

  const log = (ml: number) => {
    startTransition(async () => {
      addOptimistic(ml);

      const formData = new FormData();
      formData.set("date", today);
      formData.set("ml", String(ml));

      const result = await action(formData);
      if (!result.ok) toast.error(result.error);
    });
  };

  /* The ring fills against the lower end of the range: reaching "enough" is
     the milestone, and scaling to the upper end would make a perfectly fine
     day look two-thirds done. */
  const goal = target?.minMl ?? 2000;

  return (
    <section
      aria-labelledby="water-heading"
      className="bg-card shadow-card rounded-xl border p-4"
    >
      <h2 id="water-heading" className="text-base font-medium">
        Water
      </h2>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {target
          ? `An estimate of ${target.minMl.toLocaleString("en-IN")}–${target.maxMl.toLocaleString(
              "en-IN",
            )} ml a day, from ${target.source}.`
          : "Add a weight entry and this shows an estimated daily range."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-5">
        <ProgressRing
          value={optimisticMl}
          max={goal}
          centre={`${optimisticMl.toLocaleString("en-IN")} ml`}
          sub={`of ~${goal.toLocaleString("en-IN")}`}
          label={`${optimisticMl} millilitres logged today, against an estimated ${goal} millilitres`}
        />

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {QUICK_AMOUNTS.map((amount) => (
              <Button
                key={amount}
                type="button"
                variant="outline"
                onClick={() => log(amount)}
                disabled={pending}
              >
                <Droplet aria-hidden />+{amount} ml
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-2xs">
            Not a target you have to hit. It is here so you can see the day, not score it.
          </p>
        </div>
      </div>
    </section>
  );
}
