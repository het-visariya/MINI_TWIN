import type { Metadata } from "next";

import { ModuleStub } from "@/components/patterns/module-stub";

export const metadata: Metadata = { title: "Nutrition" };

export default function NutritionPage() {
  return (
    <ModuleStub
      title={"Nutrition"}
      description={"Food logging that takes seconds, including typing what you ate in plain words — always confirmed before it saves."}
      domain="nutrition"
      planned={[
        "Searchable Indian food database of common foods",
        "Natural-language logging: type \"2 rotis and dal\", review, then save",
        "Anything not in the database is clearly marked as an estimate",
        "Macros against targets you set, saved meals and allergy warnings",
      ]}
      connects={"Nutrition connects to fitness preferences, your daily routine, recorded allergies and — only if you ask for it — a food budget. It never produces nudges about weight or body."}
    />
  );
}
