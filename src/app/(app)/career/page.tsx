import { Briefcase, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import {
  addCertification,
  addProject,
  addRoadmapItem,
  deleteCertification,
  deleteProject,
  deleteRequirement,
  deleteRoadmapItem,
  deleteSkill,
  reorderRoadmap,
  saveCareerGoal,
  savePlacement,
  saveRequirement,
  saveSkill,
  toggleRoadmapItem,
} from "@/app/(app)/career/actions";
import { BarRows, ProgressRing } from "@/components/patterns/charts";
import { DeleteButton } from "@/components/patterns/delete-button";
import { ModuleTabs } from "@/components/patterns/module-tabs";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState, GridSkeleton } from "@/components/patterns/states";
import {
  CareerGoalForm,
  CertificationForm,
  DraftWithTwinButton,
  PlacementForm,
  ProjectForm,
  RequirementForm,
  SkillForm,
} from "@/components/career/career-forms";
import { Roadmap } from "@/components/career/roadmap";
import { getCareerRepo } from "@/lib/data/repo";
import type { CareerView } from "@/lib/data/career.repo";

export const metadata: Metadata = { title: "Career" };

export default function CareerPage() {
  return (
    <Suspense fallback={<GridSkeleton count={4} />}>
      <CareerContent />
    </Suspense>
  );
}

async function CareerContent() {
  /*
   * Opt into request-time rendering *before* reading the clock.
   *
   * With `cacheComponents` on, Next prerenders what it can, and `new Date()`
   * in a prerender is a value that would be frozen into the HTML — so it
   * refuses it outright. The repo awaits `connection()` too, but that happens
   * after this component has already called the constructor, which is too
   * late. One line here, and the page is honestly dynamic: "today" and
   * "good evening" are only true for one request anyway.
   */
  await connection();

  const repo = await getCareerRepo();
  const view = await repo.getCareer(new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Career"
        description="The gap between where you are and the role you are aiming at, using your own ratings and requirements you can edit."
        askAbout="my skill gap"
      />

      {!view.goal ? (
        <>
          <EmptyState
            icon={Briefcase}
            title="No target role yet"
            purpose="Pick a role and this becomes a gap chart: what it asks for, where you rate yourself, and the concrete next steps. Nothing here compares you with anybody else."
            action={
              <p className="text-muted-foreground text-xs">
                You can change the role, and every requirement, at any time.
              </p>
            }
          />
          <CareerGoalForm action={saveCareerGoal} />
        </>
      ) : (
        <ModuleTabs
          tabs={[
            { value: "gap", label: "Skill gap", content: <GapTab view={view} /> },
            { value: "roadmap", label: "Roadmap", content: <RoadmapTab view={view} /> },
            { value: "evidence", label: "Projects & certs", content: <EvidenceTab view={view} /> },
            {
              value: "placement",
              label: "Placement",
              content: (
                <PlacementForm
                  action={savePlacement}
                  stage={view.placement.stage}
                  notes={view.placement.notes}
                />
              ),
            },
            {
              value: "role",
              label: "Target role",
              content: (
                <CareerGoalForm
                  action={saveCareerGoal}
                  currentRole={view.goal.targetRole}
                />
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  skill gap                                 */
/* -------------------------------------------------------------------------- */

function GapTab({ view }: { view: CareerView }) {
  const { goal, gap, skills } = view;
  if (!goal) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <section
          aria-labelledby="gap-heading"
          className="bg-card shadow-card rounded-xl border p-4"
        >
          <h2 id="gap-heading" className="text-base font-medium">
            {goal.targetRole}
          </h2>
          <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
            Filled bar is where you rate yourself. The track behind it is what the role
            asks for. Biggest gap first.
          </p>

          {gap.rows.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No requirements yet. Add what the role asks for below, or pick a role
              template on the Target role tab to pre-fill them.
            </p>
          ) : (
            <BarRows
              rows={gap.rows.map((row) => ({
                label: row.skill,
                value: row.currentLevel,
                target: row.requiredLevel,
                display: `${row.currentLevel} of ${row.requiredLevel}`,
                note: row.met ? "met" : `${row.gap} to go`,
              }))}
              caption="Levels are 1 to 5, all of them your own ratings."
            />
          )}

          <div className="mt-4 border-t pt-4">
            <p className="mb-2 text-xs font-medium">Change what the role needs</p>
            <RequirementForm action={saveRequirement} careerGoalId={goal.id} />
          </div>

          {goal.requirements.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {goal.requirements.map((requirement) => (
                <li
                  key={requirement.id}
                  className="bg-surface-2/60 flex items-center gap-1 rounded-full border py-0.5 pr-0.5 pl-2.5 text-2xs"
                >
                  {requirement.skill}
                  <span className="text-muted-foreground tabular font-mono">
                    {requirement.requiredLevel}
                  </span>
                  <DeleteButton
                    action={deleteRequirement}
                    name="requirementId"
                    id={requirement.id}
                    label={requirement.skill}
                    className="size-6"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="skills-heading"
          className="bg-card shadow-card rounded-xl border p-4"
        >
          <h2 id="skills-heading" className="text-base font-medium">
            Your skills
          </h2>
          <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
            Rate yourself honestly — this chart is only useful if it is accurate, and
            nobody else sees it.
          </p>

          <SkillForm action={saveSkill} />

          {skills.length > 0 && (
            <ul className="mt-4 space-y-2 border-t pt-4">
              {skills.map((skill) => (
                <li key={skill.id} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{skill.skill}</span>
                      <span className="text-muted-foreground tabular font-mono">
                        {" "}
                        · level {skill.level}
                      </span>
                    </p>
                    {skill.evidence && (
                      <p className="text-muted-foreground mt-0.5 text-xs italic">
                        {skill.evidence}
                      </p>
                    )}
                  </div>
                  <DeleteButton
                    action={deleteSkill}
                    name="skillId"
                    id={skill.id}
                    label={skill.skill}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="space-y-6">
        <section className="bg-card shadow-card rounded-xl border p-4">
          <h2 className="text-sm font-medium">Readiness</h2>

          {gap.readiness === null ? (
            <p className="text-muted-foreground mt-2 text-xs">
              Add some requirements and this shows a percentage.
            </p>
          ) : (
            <>
              <div className="mt-3 flex items-center gap-4">
                <ProgressRing
                  value={gap.readiness * 100}
                  max={100}
                  centre={`${Math.round(gap.readiness * 100)}%`}
                  sub={`${gap.met}/${gap.total} met`}
                  label={`${Math.round(gap.readiness * 100)} percent of the role's stated requirements met`}
                />
                <p className="text-muted-foreground text-xs">
                  {gap.met} of {gap.total} skills at or above the level you set.
                </p>
              </div>

              <p className="text-muted-foreground mt-3 border-t pt-2 text-2xs leading-relaxed">
                Each skill counts only up to the level the role asks for, so being a 5
                where a 3 was wanted does not hide a missing skill. This is not a
                probability of being hired — it is arithmetic on your own ratings.
              </p>
            </>
          )}
        </section>

        {goal.targetDate && (
          <section className="bg-card shadow-card rounded-xl border p-4">
            <h2 className="text-sm font-medium">Target date</h2>
            <p className="mt-2 text-sm font-medium">
              {new Date(goal.targetDate).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {goal.daysAway === null
                ? ""
                : goal.daysAway < 0
                  ? `${Math.abs(goal.daysAway)} days ago`
                  : `${goal.daysAway} days away`}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   roadmap                                  */
/* -------------------------------------------------------------------------- */

function RoadmapTab({ view }: { view: CareerView }) {
  const { goal, roadmapProgress: progress } = view;
  if (!goal) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section
        aria-labelledby="roadmap-heading"
        className="bg-card shadow-card rounded-xl border p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="roadmap-heading" className="text-base font-medium">
              Roadmap
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              In the order you intend to do them.
            </p>
          </div>
          <DraftWithTwinButton />
        </div>

        <div className="mt-3">
          <Roadmap
            items={view.roadmap}
            careerGoalId={goal.id}
            addAction={addRoadmapItem}
            toggleAction={toggleRoadmapItem}
            reorderAction={reorderRoadmap}
            deleteAction={deleteRoadmapItem}
          />
        </div>
      </section>

      {progress.total > 0 && (
        <section className="bg-card shadow-card rounded-xl border p-4">
          <h2 className="text-sm font-medium">Progress</h2>
          <p className="tabular mt-2 font-mono text-2xl font-medium">
            {progress.done}
            <span className="text-muted-foreground text-base"> of {progress.total}</span>
          </p>
          {progress.overdue > 0 && (
            <p className="text-attention mt-1 text-xs">
              {progress.overdue} past its date
            </p>
          )}
          <p className="text-muted-foreground mt-3 border-t pt-2 text-2xs leading-relaxed">
            A date that has passed is a fact, not a judgement. Move it or drop the item —
            both are fine.
          </p>
        </section>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            projects & certificates                         */
/* -------------------------------------------------------------------------- */

const STATUS_LABELS: Record<string, string> = {
  IDEA: "Idea",
  BUILDING: "Building",
  SHIPPED: "Shipped",
  ARCHIVED: "Archived",
};

function EvidenceTab({ view }: { view: CareerView }) {
  const { projects, certifications } = view;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section
        aria-labelledby="projects-heading"
        className="bg-card shadow-card rounded-xl border p-4"
      >
        <h2 id="projects-heading" className="text-base font-medium">
          Projects
        </h2>
        <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
          What you can point at. Half-built counts — say so and it still counts.
        </p>

        <ProjectForm action={addProject} />

        {projects.length > 0 && (
          <ul className="mt-4 space-y-3 border-t pt-4">
            {projects.map((project) => (
              <li key={project.id} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {project.title}
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {STATUS_LABELS[project.status] ?? project.status}
                    </span>
                  </p>
                  {project.description && (
                    <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                      {project.description}
                    </p>
                  )}
                  {project.skills.length > 0 && (
                    <p className="text-muted-foreground mt-1 text-2xs">
                      {project.skills.join(" · ")}
                    </p>
                  )}
                  {project.url && (
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-accent mt-1 inline-flex items-center gap-1 text-xs hover:underline"
                    >
                      Open
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  )}
                </div>
                <DeleteButton
                  action={deleteProject}
                  name="projectId"
                  id={project.id}
                  label={project.title}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="certs-heading"
        className="bg-card shadow-card rounded-xl border p-4"
      >
        <h2 id="certs-heading" className="text-base font-medium">
          Certifications
        </h2>
        <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
          Only the ones you actually finished.
        </p>

        <CertificationForm action={addCertification} />

        {certifications.length > 0 && (
          <ul className="mt-4 space-y-2 border-t pt-4">
            {certifications.map((certification) => (
              <li key={certification.id} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{certification.name}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {[
                      certification.issuer,
                      certification.date &&
                        new Date(certification.date).toLocaleDateString("en-IN", {
                          month: "short",
                          year: "numeric",
                        }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {certification.url && (
                    <a
                      href={certification.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-accent mt-1 inline-flex items-center gap-1 text-xs hover:underline"
                    >
                      Verify
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  )}
                </div>
                <DeleteButton
                  action={deleteCertification}
                  name="certificationId"
                  id={certification.id}
                  label={certification.name}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
