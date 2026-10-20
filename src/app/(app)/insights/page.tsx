import type { Metadata } from "next";

import { ModuleStub } from "@/components/patterns/module-stub";

export const metadata: Metadata = { title: "Insights & reviews" };

export default function InsightsPage() {
  return (
    <ModuleStub
      title={"Insights & reviews"}
      description={"What went well, what slipped, and the patterns that only show up over weeks — stated as patterns, not proof."}
      domain="goals"
      planned={[
        "Weekly twin review: what went well, what slipped, next week's focus",
        "Twin evolution: how you changed over 30 days",
        "Life graph of your own patterns, shown only after 21+ days of data and labelled \"pattern, not proof\"",
        "Meaningful milestones instead of streak pressure",
      ]}
      connects={"Insights reads history, your feedback and whether past plans actually happened — which is also what teaches the twin to stop over-estimating what fits in a day."}
    />
  );
}
