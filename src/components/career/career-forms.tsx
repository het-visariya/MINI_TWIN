"use client";

import { Plus, Sparkles } from "lucide-react";
import { useState } from "react";

import { ActionForm, FieldError, FormError } from "@/components/patterns/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PLACEMENT_STAGES, type PlacementStage } from "@/lib/domain/calc/career";
import { ALL_TEMPLATE_SKILLS, ROLE_TEMPLATES } from "@/lib/domain/data/role-templates";
import type { ActionResult } from "@/lib/validation/shared";

const LEVELS = [
  { value: 1, label: "1 · aware of it" },
  { value: 2, label: "2 · can follow a tutorial" },
  { value: 3, label: "3 · can build with it" },
  { value: 4, label: "4 · confident unaided" },
  { value: 5, label: "5 · could teach it" },
];

/**
 * Pick a target role.
 *
 * Choosing a template copies its skills into editable rows and says so. The
 * template is explicitly a starting point: nobody surveyed employers for it,
 * and presenting it as a requirement list would be inventing an authority.
 */
export function CareerGoalForm({
  action,
  currentRole,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  currentRole?: string;
}) {
  const [templateId, setTemplateId] = useState<string>("");

  const template = ROLE_TEMPLATES.find((row) => row.id === templateId);

  return (
    <ActionForm
      action={action}
      successMessage="Target role set."
      className="bg-card shadow-card space-y-3 rounded-xl border p-4"
    >
      {({ pending, fieldErrors, result }) => (
        <>
          <div>
            <h2 className="text-base font-medium">
              {currentRole ? "Change your target role" : "What are you aiming at?"}
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {currentRole
                ? `Currently ${currentRole}. Setting a new one starts a fresh skill list.`
                : "Pick a role to pre-fill a skill list you can then correct."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="templateId" className="text-xs">
                Role
              </Label>
              <Select
                value={templateId}
                onValueChange={(value) => setTemplateId(value)}
                name="templateId"
              >
                <SelectTrigger id="templateId">
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_TEMPLATES.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {template && (
                <p className="text-muted-foreground mt-1 text-2xs">{template.blurb}</p>
              )}
            </div>

            <div>
              <Label htmlFor="targetRole" className="text-xs">
                Or type it
              </Label>
              <Input
                id="targetRole"
                name="targetRole"
                defaultValue=""
                placeholder={template?.label ?? "Backend developer"}
                /* The typed field wins, so a template plus an edited title
                   does what the user expects. */
                required={!template}
                key={template?.label}
              />
              <FieldError message={fieldErrors.targetRole} />
            </div>
          </div>

          <div className="w-44">
            <Label htmlFor="targetDate" className="text-xs">
              By when <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input id="targetDate" name="targetDate" type="date" />
          </div>

          {template && (
            <p className="text-muted-foreground bg-surface-2/60 rounded-lg border p-2.5 text-2xs leading-relaxed">
              This will add {template.skills.length} skills as a starting point, with
              suggested levels. They become yours to edit — the template is a first draft
              of what the role tends to ask for, not a standard anyone set.
            </p>
          )}

          <FormError result={result} />

          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : currentRole ? "Change role" : "Set target role"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

/** Rate one of your own skills, with optional evidence. */
export function SkillForm({
  action,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  return (
    <ActionForm action={action} successMessage="Saved." resetOnSuccess className="space-y-2">
      {({ pending, fieldErrors, result }) => (
        <>
          <datalist id="skill-suggestions">
            {ALL_TEMPLATE_SKILLS.map((skill) => (
              <option key={skill} value={skill} />
            ))}
          </datalist>

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[10rem] flex-1">
              <Label htmlFor="skill" className="text-2xs">
                Skill
              </Label>
              <Input
                id="skill"
                name="skill"
                list="skill-suggestions"
                placeholder="SQL and schema design"
                autoComplete="off"
                required
              />
            </div>

            <div className="w-48">
              <Label htmlFor="level" className="text-2xs">
                Your level
              </Label>
              <Select name="level" defaultValue="3">
                <SelectTrigger id="level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              <Plus aria-hidden />
              Save
            </Button>
          </div>

          <div>
            <Label htmlFor="evidence" className="text-2xs">
              What backs that up?{" "}
              <span className="text-muted-foreground">(optional, your words)</span>
            </Label>
            <Input
              id="evidence"
              name="evidence"
              placeholder="Built and shipped two projects on it"
              maxLength={300}
            />
          </div>

          <FieldError message={fieldErrors.skill ?? fieldErrors.level} />
          <FormError result={result} />
        </>
      )}
    </ActionForm>
  );
}

/** Change what the target role asks for. The user owns these numbers. */
export function RequirementForm({
  action,
  careerGoalId,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  careerGoalId: string;
}) {
  return (
    <ActionForm action={action} successMessage="Updated." resetOnSuccess className="space-y-2">
      {({ pending, fieldErrors }) => (
        <>
          <input type="hidden" name="careerGoalId" value={careerGoalId} />
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[10rem] flex-1">
              <Label htmlFor="req-skill" className="text-2xs">
                Skill the role needs
              </Label>
              <Input
                id="req-skill"
                name="skill"
                list="skill-suggestions"
                autoComplete="off"
                required
              />
            </div>
            <div className="w-32">
              <Label htmlFor="req-level" className="text-2xs">
                Needs level
              </Label>
              <Select name="requiredLevel" defaultValue="3">
                <SelectTrigger id="req-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              <Plus aria-hidden />
              Add
            </Button>
          </div>
          <FieldError message={fieldErrors.skill} />
        </>
      )}
    </ActionForm>
  );
}

export function CertificationForm({
  action,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  return (
    <ActionForm action={action} successMessage="Added." resetOnSuccess className="space-y-2">
      {({ pending, fieldErrors, result }) => (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[10rem] flex-1">
              <Label htmlFor="cert-name" className="text-2xs">
                Certification
              </Label>
              <Input id="cert-name" name="name" required />
            </div>
            <div className="w-32">
              <Label htmlFor="cert-issuer" className="text-2xs">
                Issuer
              </Label>
              <Input id="cert-issuer" name="issuer" placeholder="NPTEL" />
            </div>
            <div className="w-36">
              <Label htmlFor="cert-date" className="text-2xs">
                Date
              </Label>
              <Input id="cert-date" name="date" type="date" />
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              <Plus aria-hidden />
              Add
            </Button>
          </div>
          <div>
            <Label htmlFor="cert-url" className="text-2xs">
              Link <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input id="cert-url" name="url" type="url" placeholder="https://…" />
            <FieldError message={fieldErrors.url} />
          </div>
          <FormError result={result} />
        </>
      )}
    </ActionForm>
  );
}

export function ProjectForm({
  action,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  return (
    <ActionForm action={action} successMessage="Added." resetOnSuccess className="space-y-2">
      {({ pending, fieldErrors, result }) => (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[10rem] flex-1">
              <Label htmlFor="proj-title" className="text-2xs">
                Project
              </Label>
              <Input id="proj-title" name="title" required />
            </div>
            <div className="w-32">
              <Label htmlFor="proj-status" className="text-2xs">
                Status
              </Label>
              <Select name="status" defaultValue="BUILDING">
                <SelectTrigger id="proj-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IDEA">Idea</SelectItem>
                  <SelectItem value="BUILDING">Building</SelectItem>
                  <SelectItem value="SHIPPED">Shipped</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label htmlFor="proj-url" className="text-2xs">
                Link
              </Label>
              <Input id="proj-url" name="url" type="url" placeholder="https://…" />
            </div>
          </div>

          <div>
            <Label htmlFor="proj-desc" className="text-2xs">
              What it is
            </Label>
            <Textarea id="proj-desc" name="description" rows={2} />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="proj-skills" className="text-2xs">
                Skills it used{" "}
                <span className="text-muted-foreground">(comma separated)</span>
              </Label>
              <Input id="proj-skills" name="skills" placeholder="Node, Postgres, Docker" />
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              <Plus aria-hidden />
              Add
            </Button>
          </div>

          <FieldError message={fieldErrors.title ?? fieldErrors.url} />
          <FormError result={result} />
        </>
      )}
    </ActionForm>
  );
}

const STAGE_LABELS: Record<PlacementStage, string> = {
  PREPARING: "Preparing",
  APPLYING: "Applying",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  PLACED: "Placed",
};

/**
 * The placement stepper.
 *
 * Buttons rather than a progress bar, because the stage is something the user
 * sets rather than something we infer. Nothing moves it automatically.
 */
export function PlacementForm({
  action,
  stage,
  notes,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  stage: PlacementStage;
  notes: string | null;
}) {
  const [selected, setSelected] = useState<PlacementStage>(stage);

  return (
    <ActionForm
      action={action}
      successMessage="Saved."
      className="bg-card shadow-card space-y-3 rounded-xl border p-4"
    >
      {({ pending, result }) => (
        <>
          <div>
            <h2 className="text-base font-medium">Where you are</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              You set this. Nothing here moves on its own or compares you with your batch.
            </p>
          </div>

          <input type="hidden" name="stage" value={selected} />

          <ol className="flex flex-wrap gap-1.5">
            {PLACEMENT_STAGES.map((option, index) => (
              <li key={option}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={selected === option}
                  onClick={() => setSelected(option)}
                  className={cn(
                    selected === option && "border-accent/50 bg-accent/10 text-accent",
                  )}
                >
                  <span className="tabular text-muted-foreground font-mono text-2xs">
                    {index + 1}
                  </span>
                  {STAGE_LABELS[option]}
                </Button>
              </li>
            ))}
          </ol>

          <div>
            <Label htmlFor="placement-notes" className="text-xs">
              Notes
            </Label>
            <Textarea
              id="placement-notes"
              name="notes"
              rows={3}
              defaultValue={notes ?? ""}
              placeholder="Which companies, which rounds, what they ask for."
            />
          </div>

          <FormError result={result} />

          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

/**
 * The phase-4 entry point, visible and disabled.
 *
 * Shown rather than hidden so the roadmap screen is honest about what is
 * coming, with the reason in a tooltip rather than a dead button that does
 * nothing when pressed.
 */
export function DraftWithTwinButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>
          <Button type="button" variant="outline" size="sm" disabled>
            <Sparkles aria-hidden />
            Draft roadmap with twin
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Coming with Ask my twin</TooltipContent>
    </Tooltip>
  );
}
