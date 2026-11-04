/**
 * The rules a change to someone's plan has to obey.
 *
 * Pure functions over plain objects: no Prisma, no clock, no session. That is
 * deliberate and not merely tidy. These rules are the only thing standing
 * between a language model's suggestion and a student's actual timetable, so
 * they have to be exhaustively testable without a database — and they have to
 * be the *same* rules whether a change arrives from the Productivity screen,
 * from Quick Add, or from the twin proposing one.
 *
 * Every function here answers with a reason rather than a boolean. "You cannot
 * move that" is not a useful thing to tell someone about their own calendar;
 * "Lab is fixed — it cannot be moved" is.
 */

/* -------------------------------------------------------------------------- */
/*                                   types                                    */
/* -------------------------------------------------------------------------- */

export type Flexibility = "FIXED" | "SHIFTABLE" | "FLEXIBLE";

/** The minimum a scheduling rule needs to know about a commitment. */
export type Slot = {
  id: string;
  title: string;
  /** Null means unscheduled: it exists, but it is not on the clock yet. */
  start: Date | null;
  minutes: number;
  flexibility: Flexibility;
  /** Commitment ids that must finish before this one starts. */
  dependsOn?: string[];
};

export type RuleFailure = {
  /** Stable, for tests and for the UI to branch on. */
  code:
    | "fixed_commitment"
    | "overlap"
    | "dependency_order"
    | "unscheduled_dependency"
    | "past_start"
    | "too_long";
  /** Written for the user, naming the thing that is in the way. */
  message: string;
};

export type RuleResult = { ok: true } | { ok: false; failures: RuleFailure[] };

/** A day cannot hold more than this in one commitment. Catches unit slips. */
const MAX_COMMITMENT_MINUTES = 16 * 60;

/* -------------------------------------------------------------------------- */
/*                                  helpers                                   */
/* -------------------------------------------------------------------------- */

export function endOf(slot: Slot): Date | null {
  if (!slot.start) return null;
  return new Date(slot.start.getTime() + slot.minutes * 60_000);
}

/**
 * Do two scheduled slots occupy the same time?
 *
 * Touching is not overlapping: a block ending at 10:00 and one starting at
 * 10:00 are back to back, which is the normal way a timetable is built. Only
 * a strict intersection counts, or every tidy schedule would be rejected.
 */
export function overlaps(a: Slot, b: Slot): boolean {
  const aStart = a.start;
  const bStart = b.start;
  if (!aStart || !bStart) return false;

  const aEnd = endOf(a)!;
  const bEnd = endOf(b)!;

  return aStart < bEnd && bStart < aEnd;
}

/* -------------------------------------------------------------------------- */
/*                                   rules                                    */
/* -------------------------------------------------------------------------- */

/**
 * May this commitment be moved at all?
 *
 * FIXED is the one the user declared immovable — a lecture, an exam, a shift.
 * The whole value of marking something fixed is that nothing, including the
 * twin, quietly reschedules it. SHIFTABLE and FLEXIBLE differ in intent rather
 * than permission, and that difference belongs to ranking, not to this gate.
 */
export function canMove(slot: Pick<Slot, "flexibility" | "title">): RuleResult {
  if (slot.flexibility === "FIXED") {
    return {
      ok: false,
      failures: [
        {
          code: "fixed_commitment",
          message: `${slot.title} is fixed, so it cannot be moved. Move something around it instead.`,
        },
      ],
    };
  }

  return { ok: true };
}

/**
 * Would placing `candidate` collide with anything already on the day?
 *
 * `others` should be the rest of the day, excluding the candidate itself —
 * passing a list that still contains it makes everything collide with itself,
 * so the id is filtered here rather than trusting the caller to remember.
 */
export function checkOverlap(candidate: Slot, others: Slot[]): RuleResult {
  const clashes = others
    .filter((other) => other.id !== candidate.id)
    .filter((other) => overlaps(candidate, other));

  if (clashes.length === 0) return { ok: true };

  return {
    ok: false,
    failures: clashes.map((clash) => ({
      code: "overlap" as const,
      message: `That slot is already taken by ${clash.title}.`,
    })),
  };
}

/**
 * Does the proposed arrangement keep every dependency in order?
 *
 * A dependency is satisfied when the thing it depends on *finishes* before it
 * starts. Two cases are failures rather than warnings:
 *
 *   - the dependency is scheduled after, or overlapping — plainly wrong;
 *   - the dependency is not scheduled at all, while the dependent is. "Revise
 *     after the lecture" means nothing if the lecture has no time, and
 *     silently allowing it produces a plan that looks valid and is not.
 *
 * A dependency id that is not in `all` is ignored: it may belong to another
 * day, and this function cannot tell the difference between that and a stale
 * reference. Treating an unknown id as a failure would block edits for reasons
 * the user cannot see or fix.
 */
export function checkDependencies(all: Slot[]): RuleResult {
  const byId = new Map(all.map((slot) => [slot.id, slot]));
  const failures: RuleFailure[] = [];

  for (const slot of all) {
    if (!slot.start || !slot.dependsOn?.length) continue;

    for (const dependencyId of slot.dependsOn) {
      const dependency = byId.get(dependencyId);
      if (!dependency) continue;

      if (!dependency.start) {
        failures.push({
          code: "unscheduled_dependency",
          message: `${slot.title} has to come after ${dependency.title}, which has no time yet.`,
        });
        continue;
      }

      const dependencyEnd = endOf(dependency)!;

      if (dependencyEnd > slot.start) {
        failures.push({
          code: "dependency_order",
          message: `${slot.title} has to come after ${dependency.title} finishes.`,
        });
      }
    }
  }

  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

/** Catches a minutes value that is obviously a unit slip, before it is stored. */
export function checkDuration(slot: Pick<Slot, "minutes" | "title">): RuleResult {
  if (slot.minutes > MAX_COMMITMENT_MINUTES) {
    return {
      ok: false,
      failures: [
        {
          code: "too_long",
          message: `${slot.title} is longer than a waking day. Check the duration.`,
        },
      ],
    };
  }

  return { ok: true };
}

/**
 * Every rule that applies to moving one commitment to a new time.
 *
 * Collected into one call so an executor cannot enforce three of the four by
 * forgetting the fourth — the failure mode a list of separate checks invites.
 */
/**
 * Rules for *placing* something at a time — creating it, or moving it once
 * permission to move is already established.
 *
 * Deliberately excludes `canMove`. Creating a FIXED commitment is not moving
 * one: "fixed" means nothing may reschedule it later, not that it can never be
 * put on the calendar in the first place. An earlier version of this file
 * reused `checkReschedule` for creation and so refused every fixed lecture the
 * user tried to add — the rule was right and the place it was applied was not.
 */
export function checkPlacement(input: {
  candidate: Slot;
  /** The new start. Null un-schedules, which needs no placement checks. */
  to: Date | null;
  day: Slot[];
  now?: Date;
}): RuleResult {
  const { candidate, to, day, now } = input;
  const failures: RuleFailure[] = [];

  const duration = checkDuration(candidate);
  if (!duration.ok) failures.push(...duration.failures);

  if (to !== null) {
    if (now && to < now) {
      failures.push({ code: "past_start", message: "That time has already passed." });
    }

    const placed: Slot = { ...candidate, start: to };

    const overlap = checkOverlap(placed, day);
    if (!overlap.ok) failures.push(...overlap.failures);

    const withPlacement = day.some((slot) => slot.id === candidate.id)
      ? day.map((slot) => (slot.id === candidate.id ? placed : slot))
      : [...day, placed];

    const dependencies = checkDependencies(withPlacement);
    if (!dependencies.ok) failures.push(...dependencies.failures);
  }

  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

export function checkReschedule(input: {
  moving: Slot;
  /** The new start. Null un-schedules it, which is always allowed. */
  to: Date | null;
  /** Everything else on the day, including unscheduled items. */
  day: Slot[];
  /** Refuses a move into the past. Omit to allow it (e.g. backfilling). */
  now?: Date;
}): RuleResult {
  const { moving, to, day, now } = input;
  const failures: RuleFailure[] = [];

  /* The one rule creation does not share: may this be moved at all? */
  const movable = canMove(moving);
  if (!movable.ok) failures.push(...movable.failures);

  const placement = checkPlacement({ candidate: moving, to, day, now });
  if (!placement.ok) failures.push(...placement.failures);

  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

/**
 * Validate a whole rebuilt day at once.
 *
 * Used by the twin's "rebuild today" proposal, where several things move
 * together and checking each move in isolation would reject an arrangement
 * that is valid as a whole — A can only take B's slot once B has vacated it.
 */
export function checkDayPlan(input: { day: Slot[]; original: Slot[] }): RuleResult {
  const { day, original } = input;
  const failures: RuleFailure[] = [];
  const before = new Map(original.map((slot) => [slot.id, slot]));

  for (const slot of day) {
    const was = before.get(slot.id);
    if (!was) continue;

    const movedTime = (was.start?.getTime() ?? null) !== (slot.start?.getTime() ?? null);

    if (movedTime && was.flexibility === "FIXED") {
      failures.push({
        code: "fixed_commitment",
        message: `${was.title} is fixed, so it cannot be moved.`,
      });
    }

    const duration = checkDuration(slot);
    if (!duration.ok) failures.push(...duration.failures);
  }

  /* Pairwise, over scheduled items only. Quadratic, but a day holds tens of
     items at most and the clarity is worth more than the cycles. */
  const scheduled = day.filter((slot) => slot.start);

  for (let i = 0; i < scheduled.length; i += 1) {
    for (let j = i + 1; j < scheduled.length; j += 1) {
      if (overlaps(scheduled[i], scheduled[j])) {
        failures.push({
          code: "overlap",
          message: `${scheduled[i].title} and ${scheduled[j].title} are at the same time.`,
        });
      }
    }
  }

  const dependencies = checkDependencies(day);
  if (!dependencies.ok) failures.push(...dependencies.failures);

  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

/** One sentence for a toast or a card, from any number of failures. */
export function explainFailures(failures: RuleFailure[]): string {
  if (failures.length === 0) return "";
  if (failures.length === 1) return failures[0].message;

  /* De-duplicated: moving one block across three others produces the same
     sentence three times, which reads as three separate problems. */
  const unique = [...new Set(failures.map((failure) => failure.message))];

  return unique.length === 1 ? unique[0] : `${unique[0]} (and ${unique.length - 1} more)`;
}
