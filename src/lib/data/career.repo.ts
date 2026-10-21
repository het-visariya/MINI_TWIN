/**
 * The Career module's data boundary.
 *
 * One career goal is held at a time. The schema allows several — a user may
 * change direction, and the old goal's roadmap should not vanish — but the
 * screen works with the most recent, because a skill gap against two target
 * roles at once is a chart nobody can read.
 */

import { connection } from "next/server";

import { careerView } from "@/lib/data/module-fixtures";
import { getPrisma } from "@/lib/db";
import { isoDate } from "@/lib/domain/calc/health";
import {
  daysToTarget,
  placementProgress,
  roadmapProgress,
  skillGap,
  type PlacementStage,
  type RoadmapProgress,
  type SkillGap,
} from "@/lib/domain/calc/career";
import { findRoleTemplate } from "@/lib/domain/data/role-templates";
import type {
  CareerGoalInput,
  CertificationInput,
  ProjectInput,
  UserSkillInput,
} from "@/lib/validation/career";

/* -------------------------------------------------------------------------- */
/*                                   views                                    */
/* -------------------------------------------------------------------------- */

export type RequirementView = { id: string; skill: string; requiredLevel: number };

export type SkillView = {
  id: string;
  skill: string;
  level: number;
  evidence: string | null;
};

export type CertificationView = {
  id: string;
  name: string;
  issuer: string | null;
  date: string | null;
  url: string | null;
};

export type ProjectView = {
  id: string;
  title: string;
  description: string | null;
  skills: string[];
  url: string | null;
  status: "IDEA" | "BUILDING" | "SHIPPED" | "ARCHIVED";
};

export type RoadmapItemView = {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
  order: number;
};

export type CareerView = {
  goal: {
    id: string;
    targetRole: string;
    targetDate: string | null;
    daysAway: number | null;
    requirements: RequirementView[];
  } | null;
  skills: SkillView[];
  gap: SkillGap;
  certifications: CertificationView[];
  projects: ProjectView[];
  placement: { stage: PlacementStage; notes: string | null; progress: number };
  roadmap: RoadmapItemView[];
  roadmapProgress: RoadmapProgress;
};

export type CareerRepo = {
  getCareer(now?: Date): Promise<CareerView>;
  saveGoal(input: CareerGoalInput): Promise<void>;
  saveRequirement(careerGoalId: string, skill: string, requiredLevel: number): Promise<void>;
  deleteRequirement(requirementId: string): Promise<void>;
  saveSkill(input: UserSkillInput): Promise<void>;
  deleteSkill(skillId: string): Promise<void>;
  addCertification(input: CertificationInput): Promise<void>;
  deleteCertification(certificationId: string): Promise<void>;
  addProject(input: ProjectInput): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
  savePlacement(stage: PlacementStage, notes?: string): Promise<void>;
  addRoadmapItem(careerGoalId: string, title: string, dueDate?: Date): Promise<void>;
  toggleRoadmapItem(itemId: string): Promise<void>;
  reorderRoadmap(careerGoalId: string, orderedIds: string[]): Promise<void>;
  deleteRoadmapItem(itemId: string): Promise<void>;
};

/* -------------------------------------------------------------------------- */
/*                                  per user                                  */
/* -------------------------------------------------------------------------- */

export function careerRepoForUser(userId: string): CareerRepo {
  const prisma = getPrisma();

  return {
    async getCareer(now = new Date()) {
      await connection();

      const [goal, skills, certifications, projects, placement] = await Promise.all([
        prisma.careerGoal.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
          include: {
            requirements: { orderBy: { skill: "asc" } },
            roadmap: { orderBy: { order: "asc" } },
          },
        }),
        prisma.userSkill.findMany({ where: { userId }, orderBy: { skill: "asc" } }),
        prisma.certification.findMany({ where: { userId }, orderBy: { date: "desc" } }),
        prisma.project.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
        prisma.placementStatus.findUnique({ where: { userId } }),
      ]);

      const skillViews: SkillView[] = skills.map((row) => ({
        id: row.id,
        skill: row.skill,
        level: row.level,
        evidence: row.evidence,
      }));

      const roadmap: RoadmapItemView[] = (goal?.roadmap ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        dueDate: row.dueDate ? isoDate(row.dueDate) : null,
        done: row.done,
        order: row.order,
      }));

      const stage = (placement?.stage ?? "PREPARING") as PlacementStage;

      return {
        goal: goal
          ? {
              id: goal.id,
              targetRole: goal.targetRole,
              targetDate: goal.targetDate ? isoDate(goal.targetDate) : null,
              daysAway: daysToTarget(goal.targetDate, now),
              requirements: goal.requirements.map((row) => ({
                id: row.id,
                skill: row.skill,
                requiredLevel: row.requiredLevel,
              })),
            }
          : null,

        skills: skillViews,
        gap: skillGap(goal?.requirements ?? [], skillViews),

        certifications: certifications.map((row) => ({
          id: row.id,
          name: row.name,
          issuer: row.issuer,
          date: row.date ? isoDate(row.date) : null,
          url: row.url,
        })),

        projects: projects.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          skills: row.skills,
          url: row.url,
          status: row.status as ProjectView["status"],
        })),

        placement: {
          stage,
          notes: placement?.notes ?? null,
          progress: placementProgress(stage),
        },

        roadmap,
        roadmapProgress: roadmapProgress(roadmap, now),
      };
    },

    /**
     * Create or replace the target role.
     *
     * Picking a template copies its skills into editable requirement rows. It
     * is a starting point: the rows belong to the user from that moment and
     * the template is never consulted again.
     */
    async saveGoal(input) {
      const template = input.templateId ? findRoleTemplate(input.templateId) : undefined;

      await prisma.careerGoal.create({
        data: {
          userId,
          targetRole: input.targetRole,
          targetDate: input.targetDate ?? null,
          requirements: template
            ? {
                create: template.skills.map((skill) => ({
                  skill: skill.skill,
                  requiredLevel: skill.requiredLevel,
                })),
              }
            : undefined,
        },
      });
    },

    async saveRequirement(careerGoalId, skill, requiredLevel) {
      /* Scoped through the goal's own userId, so a requirement cannot be
         attached to somebody else's goal by passing its id. */
      const goal = await prisma.careerGoal.findFirst({
        where: { id: careerGoalId, userId },
        select: { id: true },
      });
      if (!goal) throw new Error("That goal could not be found.");

      await prisma.roleSkillRequirement.upsert({
        where: { careerGoalId_skill: { careerGoalId, skill } },
        create: { careerGoalId, skill, requiredLevel },
        update: { requiredLevel },
      });
    },

    async deleteRequirement(requirementId) {
      await prisma.roleSkillRequirement.deleteMany({
        where: { id: requirementId, careerGoal: { userId } },
      });
    },

    async saveSkill(input) {
      await prisma.userSkill.upsert({
        where: { userId_skill: { userId, skill: input.skill } },
        create: {
          userId,
          skill: input.skill,
          level: input.level,
          evidence: input.evidence ?? null,
        },
        update: { level: input.level, evidence: input.evidence ?? null },
      });
    },

    async deleteSkill(skillId) {
      await prisma.userSkill.deleteMany({ where: { id: skillId, userId } });
    },

    async addCertification(input) {
      await prisma.certification.create({
        data: {
          userId,
          name: input.name,
          issuer: input.issuer ?? null,
          date: input.date ?? null,
          url: input.url ?? null,
        },
      });
    },

    async deleteCertification(certificationId) {
      await prisma.certification.deleteMany({ where: { id: certificationId, userId } });
    },

    async addProject(input) {
      await prisma.project.create({
        data: {
          userId,
          title: input.title,
          description: input.description ?? null,
          skills: input.skills,
          url: input.url ?? null,
          status: input.status,
        },
      });
    },

    async deleteProject(projectId) {
      await prisma.project.deleteMany({ where: { id: projectId, userId } });
    },

    async savePlacement(stage, notes) {
      await prisma.placementStatus.upsert({
        where: { userId },
        create: { userId, stage, notes: notes ?? null },
        update: { stage, notes: notes ?? null },
      });
    },

    async addRoadmapItem(careerGoalId, title, dueDate) {
      const goal = await prisma.careerGoal.findFirst({
        where: { id: careerGoalId, userId },
        select: { id: true },
      });
      if (!goal) throw new Error("That goal could not be found.");

      /* Appended to the end, which is where a newly thought-of step belongs
         until the user drags it somewhere. */
      const last = await prisma.roadmapItem.findFirst({
        where: { careerGoalId },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      await prisma.roadmapItem.create({
        data: {
          userId,
          careerGoalId,
          title,
          dueDate: dueDate ?? null,
          order: (last?.order ?? -1) + 1,
        },
      });
    },

    async toggleRoadmapItem(itemId) {
      const item = await prisma.roadmapItem.findFirst({
        where: { id: itemId, userId },
        select: { id: true, done: true },
      });
      if (!item) throw new Error("That item could not be found.");

      await prisma.roadmapItem.update({
        where: { id: item.id },
        data: { done: !item.done },
      });
    },

    /**
     * Rewrite the whole order from the given list.
     *
     * One transaction: a half-applied reorder leaves two items claiming the
     * same position, and the list would render in an order the user did not
     * choose. Ids not belonging to this user match nothing and are skipped.
     */
    async reorderRoadmap(careerGoalId, orderedIds) {
      const owned = await prisma.roadmapItem.findMany({
        where: { careerGoalId, userId },
        select: { id: true },
      });
      const ownedIds = new Set(owned.map((row) => row.id));

      await prisma.$transaction(
        orderedIds
          .filter((id) => ownedIds.has(id))
          .map((id, index) =>
            prisma.roadmapItem.update({ where: { id }, data: { order: index } }),
          ),
      );
    },

    async deleteRoadmapItem(itemId) {
      await prisma.roadmapItem.deleteMany({ where: { id: itemId, userId } });
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                    demo                                    */
/* -------------------------------------------------------------------------- */

export const demoCareerRepo: CareerRepo = {
  async getCareer(now = new Date()) {
    await connection();
    return careerView(now);
  },

  async saveGoal() {},
  async saveRequirement() {},
  async deleteRequirement() {},
  async saveSkill() {},
  async deleteSkill() {},
  async addCertification() {},
  async deleteCertification() {},
  async addProject() {},
  async deleteProject() {},
  async savePlacement() {},
  async addRoadmapItem() {},
  async toggleRoadmapItem() {},
  async reorderRoadmap() {},
  async deleteRoadmapItem() {},
};
