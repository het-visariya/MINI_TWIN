/**
 * The planning invariants.
 *
 * These matter more than most tests here, because these rules are the only
 * thing between a language model's suggestion and a student's real timetable.
 * Each invariant from the inspection has a case, and the awkward ones — the
 * back-to-back boundary, a swap that is only valid as a whole, an unscheduled
 * dependency — have their own, because those are where a plausible-looking
 * implementation quietly says yes.
 */

import { describe, expect, it } from "vitest";

import {
  canMove,
  checkDayPlan,
  checkPlacement,
  checkDependencies,
  checkDuration,
  checkOverlap,
  checkReschedule,
  endOf,
  explainFailures,
  overlaps,
  type Slot,
} from "@/lib/domain/calc/planning-rules";

const at = (hour: number, minute = 0) => new Date(2026, 10, 4, hour, minute);

function slot(partial: Partial<Slot> & { id: string }): Slot {
  return {
    title: partial.id,
    start: at(9),
    minutes: 60,
    flexibility: "FLEXIBLE",
    ...partial,
  };
}

const codes = (result: ReturnType<typeof canMove>) =>
  result.ok ? [] : result.failures.map((f) => f.code);

describe("overlaps", () => {
  it("is true when two blocks intersect", () => {
    expect(
      overlaps(slot({ id: "a", start: at(9) }), slot({ id: "b", start: at(9, 30) })),
    ).toBe(true);
  });

  it("is FALSE for back-to-back blocks", () => {
    /* 09:00-10:00 and 10:00-11:00 is how a tidy timetable looks. Treating a
       shared boundary as a clash would reject almost every real day. */
    expect(
      overlaps(slot({ id: "a", start: at(9) }), slot({ id: "b", start: at(10) })),
    ).toBe(false);
  });

  it("is false when either side is unscheduled", () => {
    expect(overlaps(slot({ id: "a", start: null }), slot({ id: "b" }))).toBe(false);
  });

  it("computes the end from start plus minutes", () => {
    expect(endOf(slot({ id: "a", start: at(9), minutes: 90 }))).toEqual(at(10, 30));
  });
});

describe("canMove", () => {
  it("refuses a FIXED commitment, and names it", () => {
    const result = canMove({ flexibility: "FIXED", title: "DBMS Lab" });

    expect(result.ok).toBe(false);
    expect(codes(result)).toEqual(["fixed_commitment"]);
    if (!result.ok) expect(result.failures[0].message).toContain("DBMS Lab");
  });

  it("allows SHIFTABLE and FLEXIBLE", () => {
    expect(canMove({ flexibility: "SHIFTABLE", title: "Gym" }).ok).toBe(true);
    expect(canMove({ flexibility: "FLEXIBLE", title: "Reading" }).ok).toBe(true);
  });
});

describe("checkOverlap", () => {
  it("does not let a slot collide with itself", () => {
    const a = slot({ id: "a" });
    expect(checkOverlap(a, [a]).ok).toBe(true);
  });

  it("reports the blocker by name", () => {
    const result = checkOverlap(slot({ id: "a", start: at(9, 30) }), [
      slot({ id: "b", title: "Lecture", start: at(9) }),
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures[0].message).toContain("Lecture");
  });
});

describe("checkDependencies", () => {
  it("accepts a dependency that finishes before its dependent starts", () => {
    expect(
      checkDependencies([
        slot({ id: "lecture", start: at(9), minutes: 60 }),
        slot({ id: "revision", start: at(10), dependsOn: ["lecture"] }),
      ]).ok,
    ).toBe(true);
  });

  it("rejects a dependent scheduled before its dependency", () => {
    const result = checkDependencies([
      slot({ id: "lecture", title: "Lecture", start: at(14) }),
      slot({ id: "revision", title: "Revision", start: at(9), dependsOn: ["lecture"] }),
    ]);

    expect(codes(result)).toEqual(["dependency_order"]);
  });

  it("rejects a dependent whose dependency has no time at all", () => {
    /* A plan that says "revise after the lecture" with no lecture scheduled
       looks valid and is not. */
    const result = checkDependencies([
      slot({ id: "lecture", title: "Lecture", start: null }),
      slot({ id: "revision", title: "Revision", start: at(9), dependsOn: ["lecture"] }),
    ]);

    expect(codes(result)).toEqual(["unscheduled_dependency"]);
  });

  it("ignores a dependency id that is not in the set", () => {
    /* It may belong to another day; this function cannot tell that from a
       stale reference, and blocking the edit would be unfixable by the user. */
    expect(
      checkDependencies([slot({ id: "a", start: at(9), dependsOn: ["elsewhere"] })]).ok,
    ).toBe(true);
  });
});

describe("checkDuration", () => {
  it("rejects a commitment longer than a waking day", () => {
    expect(codes(checkDuration({ minutes: 20 * 60, title: "Study" }))).toEqual([
      "too_long",
    ]);
  });

  it("allows a long but plausible block", () => {
    expect(checkDuration({ minutes: 6 * 60, title: "Exam" }).ok).toBe(true);
  });
});

describe("checkReschedule", () => {
  const day = () => [
    slot({ id: "lab", title: "Lab", start: at(14), flexibility: "FIXED" }),
    slot({ id: "gym", title: "Gym", start: at(18), flexibility: "SHIFTABLE" }),
  ];

  it("allows a clear move", () => {
    const result = checkReschedule({
      moving: slot({ id: "gym", title: "Gym", start: at(18), flexibility: "SHIFTABLE" }),
      to: at(7),
      day: day(),
    });

    expect(result.ok).toBe(true);
  });

  it("refuses to move a fixed commitment even into a free slot", () => {
    const result = checkReschedule({
      moving: slot({ id: "lab", title: "Lab", start: at(14), flexibility: "FIXED" }),
      to: at(7),
      day: day(),
    });

    expect(codes(result)).toContain("fixed_commitment");
  });

  it("refuses a move onto an occupied slot", () => {
    const result = checkReschedule({
      moving: slot({ id: "gym", title: "Gym", start: at(18), flexibility: "SHIFTABLE" }),
      to: at(14, 30),
      day: day(),
    });

    expect(codes(result)).toContain("overlap");
  });

  it("allows un-scheduling without any placement checks", () => {
    /* Nothing can collide with a thing that is not on the clock. */
    const result = checkReschedule({
      moving: slot({ id: "gym", title: "Gym", flexibility: "SHIFTABLE" }),
      to: null,
      day: day(),
      now: at(12),
    });

    expect(result.ok).toBe(true);
  });

  it("refuses a move into the past when a clock is supplied", () => {
    const result = checkReschedule({
      moving: slot({ id: "gym", title: "Gym", flexibility: "FLEXIBLE" }),
      to: at(6),
      day: day(),
      now: at(12),
    });

    expect(codes(result)).toContain("past_start");
  });

  it("allows a past start when no clock is supplied, for backfilling", () => {
    expect(
      checkReschedule({
        moving: slot({ id: "gym", title: "Gym", flexibility: "FLEXIBLE" }),
        to: at(6),
        day: day(),
      }).ok,
    ).toBe(true);
  });

  it("collects every reason at once rather than stopping at the first", () => {
    /* The user should learn everything wrong with a move in one go. */
    const result = checkReschedule({
      moving: slot({ id: "lab", title: "Lab", start: at(14), flexibility: "FIXED" }),
      to: at(18, 30),
      day: day(),
      now: at(20),
    });

    expect(codes(result)).toEqual(
      expect.arrayContaining(["fixed_commitment", "overlap", "past_start"]),
    );
  });
});

describe("checkPlacement", () => {
  it("ALLOWS creating a FIXED commitment at a time", () => {
    /* Regression. The repo first reused checkReschedule for creation, so
       `canMove` fired and every fixed lecture the user tried to add was
       refused. "Fixed" means nothing may move it later, not that it can
       never be put on the calendar at all. */
    const result = checkPlacement({
      candidate: slot({ id: "new", title: "Lab", flexibility: "FIXED" }),
      to: at(14),
      day: [],
    });

    expect(result.ok).toBe(true);
  });

  it("still refuses to place one on top of something else", () => {
    const result = checkPlacement({
      candidate: slot({ id: "new", title: "Lab", flexibility: "FIXED" }),
      to: at(9, 30),
      day: [slot({ id: "a", title: "Lecture", start: at(9) })],
    });

    expect(codes(result)).toContain("overlap");
  });

  it("includes a brand-new slot when checking dependencies", () => {
    /* The candidate is not yet in `day`, so it has to be appended rather than
       substituted, or its own dependency is never examined. */
    const result = checkPlacement({
      candidate: slot({ id: "new", title: "Revise", dependsOn: ["lecture"] }),
      to: at(9),
      day: [slot({ id: "lecture", title: "Lecture", start: at(14) })],
    });

    expect(codes(result)).toContain("dependency_order");
  });
});

describe("checkDayPlan", () => {
  const original = [
    slot({ id: "lab", title: "Lab", start: at(14), flexibility: "FIXED" }),
    slot({ id: "gym", title: "Gym", start: at(18), flexibility: "SHIFTABLE" }),
    slot({ id: "read", title: "Reading", start: at(20), flexibility: "FLEXIBLE" }),
  ];

  it("accepts a swap that is only valid as a whole", () => {
    /* Checked one move at a time, Gym->20:00 collides with Reading and would
       be rejected, even though the finished arrangement is fine. This is the
       reason a whole-day check exists. */
    const rebuilt = [
      slot({ id: "lab", title: "Lab", start: at(14), flexibility: "FIXED" }),
      slot({ id: "gym", title: "Gym", start: at(20), flexibility: "SHIFTABLE" }),
      slot({ id: "read", title: "Reading", start: at(18), flexibility: "FLEXIBLE" }),
    ];

    expect(checkDayPlan({ day: rebuilt, original }).ok).toBe(true);
  });

  it("rejects a rebuild that moves a fixed commitment", () => {
    const rebuilt = original.map((s) =>
      s.id === "lab" ? { ...s, start: at(11) } : s,
    );

    expect(codes(checkDayPlan({ day: rebuilt, original }))).toContain("fixed_commitment");
  });

  it("leaves a fixed commitment alone when it has not moved", () => {
    const rebuilt = original.map((s) => (s.id === "gym" ? { ...s, start: at(7) } : s));

    expect(checkDayPlan({ day: rebuilt, original }).ok).toBe(true);
  });

  it("rejects a rebuild that double-books a slot", () => {
    const rebuilt = original.map((s) => (s.id === "gym" ? { ...s, start: at(20) } : s));

    expect(codes(checkDayPlan({ day: rebuilt, original }))).toContain("overlap");
  });

  it("rejects a rebuild that breaks a dependency", () => {
    const withDependency = [
      slot({ id: "lecture", title: "Lecture", start: at(9) }),
      slot({ id: "revise", title: "Revise", start: at(11), dependsOn: ["lecture"] }),
    ];
    const rebuilt = withDependency.map((s) =>
      s.id === "revise" ? { ...s, start: at(7) } : s,
    );

    expect(codes(checkDayPlan({ day: rebuilt, original: withDependency }))).toContain(
      "dependency_order",
    );
  });
});

describe("explainFailures", () => {
  it("returns the single message unchanged", () => {
    expect(explainFailures([{ code: "overlap", message: "Taken by Lab." }])).toBe(
      "Taken by Lab.",
    );
  });

  it("de-duplicates identical messages", () => {
    /* One move across three identical blockers is one problem, not three. */
    const same = { code: "overlap" as const, message: "Taken by Lab." };
    expect(explainFailures([same, same, same])).toBe("Taken by Lab.");
  });

  it("summarises distinct messages without burying the first", () => {
    expect(
      explainFailures([
        { code: "overlap", message: "Taken by Lab." },
        { code: "past_start", message: "That time has passed." },
      ]),
    ).toBe("Taken by Lab. (and 1 more)");
  });

  it("is empty for no failures", () => {
    expect(explainFailures([])).toBe("");
  });
});
