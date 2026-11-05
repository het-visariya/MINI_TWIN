/**
 * Career input schemas.
 *
 * Levels are the same 1-5 scale everywhere, and `level` is imported rather
 * than redeclared so the skills editor and the role requirements can never
 * drift onto different scales.
 */

import { z } from "zod";

import {
  boundedDate,
  level,
  optionalText,
  shortText,
  stringList,
} from "@/lib/validation/shared";

export const placementStage = z.enum([
  "PREPARING",
  "APPLYING",
  "INTERVIEWING",
  "OFFER",
  "PLACED",
]);

export const projectStatus = z.enum(["IDEA", "BUILDING", "SHIPPED", "ARCHIVED"]);

export const careerGoalSchema = z.object({
  targetRole: shortText(120),
  targetDate: boundedDate.optional(),
  /**
   * The template whose skills pre-fill the requirements. Optional: a user may
   * type a role no template covers and add the skills themselves.
   */
  templateId: optionalText(40),
});

export const requirementSchema = z.object({
  careerGoalId: z.string().trim().min(1),
  skill: shortText(80),
  requiredLevel: level,
});

export const deleteRequirementSchema = z.object({
  requirementId: z.string().trim().min(1),
});

export const userSkillSchema = z.object({
  skill: shortText(80),
  level,
  /** What backs the rating up, in the user's words. Never inferred for them. */
  evidence: optionalText(300),
});

export const deleteSkillSchema = z.object({ skillId: z.string().trim().min(1) });

/** A plain https URL, or nothing. Rejects javascript: and data: outright. */
const httpUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .refine(
    (value) => value === undefined || /^https?:\/\//i.test(value),
    "Links need to start with http:// or https://.",
  );

export const certificationSchema = z.object({
  name: shortText(120),
  issuer: optionalText(120),
  date: boundedDate.optional(),
  url: httpUrl,
});

export const deleteCertificationSchema = z.object({
  certificationId: z.string().trim().min(1),
});

export const projectSchema = z.object({
  title: shortText(120),
  description: optionalText(1000),
  skills: stringList(15),
  url: httpUrl,
  status: projectStatus.default("BUILDING"),
});

export const deleteProjectSchema = z.object({ projectId: z.string().trim().min(1) });

export const placementSchema = z.object({
  stage: placementStage,
  notes: optionalText(1000),
});

export const roadmapItemSchema = z.object({
  careerGoalId: z.string().trim().min(1),
  title: shortText(160),
  dueDate: boundedDate.optional(),
});

export const toggleRoadmapSchema = z.object({
  itemId: z.string().trim().min(1),
});

export const reorderRoadmapSchema = z.object({
  careerGoalId: z.string().trim().min(1),
  /** The item ids in their new order. Positions are rewritten from this. */
  orderedIds: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(200),
});

export const deleteRoadmapItemSchema = z.object({ itemId: z.string().trim().min(1) });

export type CareerGoalInput = z.infer<typeof careerGoalSchema>;
export type UserSkillInput = z.infer<typeof userSkillSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type CertificationInput = z.infer<typeof certificationSchema>;
