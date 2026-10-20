import type { Metadata } from "next";

import { ModuleStub } from "@/components/patterns/module-stub";

export const metadata: Metadata = { title: "Career" };

export default function CareerPage() {
  return (
    <ModuleStub
      title={"Career"}
      description={"Where you want to get to, which skills that needs, and what this week does about it."}
      domain="career"
      planned={[
        "Career goal and gap analysis: target role, your skill levels, and the gap",
        "Certifications, projects and placement status in one record",
        "A roadmap to the target role that creates real tasks and deadlines",
      ]}
      connects={"Career is the module that creates work for the others: roadmap milestones become learning tasks and deadlines that coexist with coursework, instead of becoming a second, separate checklist."}
    />
  );
}
