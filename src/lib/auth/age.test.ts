import { describe, expect, it } from "vitest";

import { ageOn, ageSafety, checkAge, parseDob } from "@/lib/auth/age";

/**
 * The age gate decides who may have an account at all, so the boundaries get
 * tested rather than eyeballed. "On your 13th birthday" and "the day before"
 * are the two cases a date-maths bug actually lands on.
 */

const ON = new Date(Date.UTC(2026, 9, 20)); // 20 October 2026

describe("ageOn", () => {
  it("counts a birthday that has already passed this year", () => {
    expect(ageOn(new Date(Date.UTC(2000, 0, 1)), ON)).toBe(26);
  });

  it("does not count a birthday still to come this year", () => {
    expect(ageOn(new Date(Date.UTC(2000, 11, 31)), ON)).toBe(25);
  });

  it("counts the birthday itself", () => {
    expect(ageOn(new Date(Date.UTC(2000, 9, 20)), ON)).toBe(26);
  });

  it("does not count the day before the birthday", () => {
    expect(ageOn(new Date(Date.UTC(2000, 9, 21)), ON)).toBe(25);
  });
});

describe("parseDob", () => {
  it("reads an ISO date as UTC midnight, not local", () => {
    const parsed = parseDob("2004-03-09");
    expect(parsed?.getUTCFullYear()).toBe(2004);
    expect(parsed?.getUTCMonth()).toBe(2);
    expect(parsed?.getUTCDate()).toBe(9);
  });

  it("rejects a day that does not exist instead of rolling it forward", () => {
    expect(parseDob("2025-02-30")).toBeNull();
    expect(parseDob("2025-13-01")).toBeNull();
  });

  it("rejects anything that is not YYYY-MM-DD", () => {
    expect(parseDob("09/03/2004")).toBeNull();
    expect(parseDob("")).toBeNull();
    expect(parseDob("not a date")).toBeNull();
  });
});

describe("checkAge", () => {
  it("blocks under-13s as children", () => {
    expect(checkAge("2015-01-01", ON).outcome).toBe("blocked-child");
  });

  it("blocks 13 to 17 pending parental consent", () => {
    expect(checkAge("2013-10-20", ON).outcome).toBe("blocked-minor");
    expect(checkAge("2008-10-21", ON).outcome).toBe("blocked-minor");
  });

  it("allows exactly 18 on the birthday", () => {
    expect(checkAge("2008-10-20", ON).outcome).toBe("allowed");
  });

  it("blocks the day before turning 18", () => {
    const verdict = checkAge("2008-10-21", ON);
    expect(verdict.outcome).toBe("blocked-minor");
    expect(verdict).toMatchObject({ age: 17 });
  });

  it("treats a 13th birthday as a minor, not a child", () => {
    expect(checkAge("2013-10-20", ON)).toMatchObject({
      outcome: "blocked-minor",
      age: 13,
    });
    expect(checkAge("2013-10-21", ON)).toMatchObject({
      outcome: "blocked-child",
      age: 12,
    });
  });

  it("rejects a future date", () => {
    expect(checkAge("2030-01-01", ON).outcome).toBe("invalid");
  });

  it("rejects an implausible year rather than allowing it", () => {
    expect(checkAge("1850-01-01", ON).outcome).toBe("invalid");
  });

  it("rejects malformed input", () => {
    expect(checkAge("", ON).outcome).toBe("invalid");
    expect(checkAge("2004-02-30", ON).outcome).toBe("invalid");
  });
});

describe("ageSafety", () => {
  it("uses BMI-for-age and forbids weight targets under 20", () => {
    expect(ageSafety(19)).toEqual({
      usesBmiForAge: true,
      allowsWeightTargets: false,
      allowsCalorieTargets: false,
    });
  });

  it("switches to adult rules at 20", () => {
    expect(ageSafety(20)).toEqual({
      usesBmiForAge: false,
      allowsWeightTargets: true,
      allowsCalorieTargets: true,
    });
  });
});
