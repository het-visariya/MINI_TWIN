/**
 * Prisma rows to domain objects.
 *
 * The database uses SCREAMING_CASE enums because that is the Postgres
 * convention; the domain model uses lowercase unions because that is what the
 * UI reads. This file is the only place that knows both.
 */

import type { Domain, Priority, Subject, Task } from "@/lib/domain/types";

export function toDomain(value: string): Domain {
  return value.toLowerCase() as Domain;
}

export function toPriority(value: string): Priority {
  return value.toLowerCase() as Priority;
}

/** Domain union to the Prisma enum, for writes. */
export function fromDomain(value: Domain) {
  return value.toUpperCase() as Uppercase<Domain>;
}

export function fromPriority(value: Priority) {
  return value.toUpperCase() as Uppercase<Priority>;
}

export function toTask(row: {
  id: string;
  title: string;
  domain: string;
  due: Date | null;
  estimateMinutes: number;
  progress: number;
  priority: string;
  why: string | null;
  done: boolean;
}): Task {
  return {
    id: row.id,
    title: row.title,
    domain: toDomain(row.domain),
    due: row.due?.toISOString(),
    estimateMinutes: row.estimateMinutes,
    progress: row.progress,
    priority: toPriority(row.priority),
    /* The ranking engine arrives in phase 3. Until then the row's own stored
       reason is used, and a task with none says so rather than inventing one. */
    why: row.why ?? "Ranked by due date until you have enough history to rank by consequence.",
    done: row.done,
  };
}

/** 1–5 user rating to the three bands the academic screens show. */
export function toSubjectDifficulty(rating: number): Subject["difficulty"] {
  if (rating >= 4) return "high";
  if (rating <= 2) return "low";
  return "medium";
}

export function toSubject(row: {
  id: string;
  name: string;
  code: string | null;
  credits: number;
  difficulty: number;
  classesHeld: number;
  classesAttended: number;
  minAttendancePct: number;
}): Subject {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? undefined,
    credits: row.credits,
    difficulty: toSubjectDifficulty(row.difficulty),
    attendance: {
      attended: row.classesAttended,
      held: row.classesHeld,
      required: row.minAttendancePct,
    },
  };
}
