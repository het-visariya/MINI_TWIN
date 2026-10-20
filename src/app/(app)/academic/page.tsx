import { ArrowDown } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { AttendanceRow } from "@/components/academic/attendance-row";
import { CgpaWhatIf } from "@/components/academic/cgpa-what-if";
import { PageHeader } from "@/components/patterns/page-header";
import { ScoreCard } from "@/components/patterns/score-card";
import { GridSkeleton } from "@/components/patterns/states";
import { repo } from "@/lib/data/repo";

export const metadata: Metadata = { title: "Academic" };

async function AcademicContent() {
  const { subjects, risk, cgpa, cascade } = await repo.getAcademic();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic"
        description="Subjects, attendance, deadlines and what each of them does to your grades. Every number here traces back to something you entered."
        askAbout="my academic standing"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="subjects-heading" className="space-y-3">
          <h2 id="subjects-heading" className="text-base font-medium">
            Subjects &amp; attendance
          </h2>
          <p className="text-muted-foreground text-xs">
            One tap marks today. The bunk budget shows how many classes you can still
            miss, and how many you would need to recover.
          </p>

          <Stagger className="space-y-3">
            {subjects.map((subject) => (
              <StaggerItem key={subject.id}>
                <AttendanceRow subject={subject} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        <div className="space-y-6">
          <ScoreCard score={risk} />

          <section
            aria-labelledby="cascade-heading"
            className="bg-card shadow-card rounded-xl border p-4"
          >
            <h2 id="cascade-heading" className="text-sm font-medium">
              Deadline cascade
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              What one missed assignment actually sets off. Each stage is calculated
              from the marking scheme you entered — not a warning invented to push you.
            </p>

            <ol className="mt-4 space-y-0">
              {cascade.map((step, index) => (
                <li key={step.stage}>
                  <div className="flex gap-3">
                    <span className="bg-muted text-muted-foreground tabular flex size-6 shrink-0 items-center justify-center rounded-full text-2xs font-medium">
                      {index + 1}
                    </span>
                    <div className="pb-3">
                      <p className="text-sm font-medium">{step.stage}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {step.detail}
                      </p>
                    </div>
                  </div>
                  {index < cascade.length - 1 && (
                    <ArrowDown
                      className="text-muted-foreground mb-3 ml-1.5 size-3"
                      aria-hidden
                    />
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <CgpaWhatIf simulation={cgpa} />
    </div>
  );
}

export default function AcademicPage() {
  return (
    <Suspense fallback={<GridSkeleton count={4} />}>
      <AcademicContent />
    </Suspense>
  );
}
