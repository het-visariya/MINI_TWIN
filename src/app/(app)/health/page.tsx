import type { Metadata } from "next";

import { ModuleStub } from "@/components/patterns/module-stub";

export const metadata: Metadata = { title: "Health" };

export default function HealthPage() {
  return (
    <ModuleStub
      title={"Health"}
      description={"Workouts, sleep, weight and a five-second mood check — tracked for awareness, with no targets you did not set."}
      domain="health"
      planned={[
        "Workout logger: exercises, sets, reps, weight, personal records and weekly volume",
        "Weight and sleep logs, with your own trend rather than a target",
        "BMI (adult categories from 20; BMI-for-age percentile under 20)",
        "Protein, water and calorie estimates, each marked as an estimate",
        "Mood and energy check-in — five seconds, optional, never required",
        "Safety rules: no weight-loss targets under 20, and a doctor note when a condition is recorded",
      ]}
      connects={"Health informs the capacity the planner works with: sleep and recorded energy change how much the twin suggests fitting into a day, and workouts take part in the one scheduling model like any other commitment."}
    />
  );
}
