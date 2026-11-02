/**
 * The calendar-date round trip.
 *
 * Guards a bug that reached production behaviour: picking the 2nd in the
 * expense form saved the expense on the 1st, and the same silently applied to
 * meals, weights, workouts and habits — every `@db.Date` column in the schema.
 *
 * The cause was a mismatch of conventions. `toCalendarDate` built *local*
 * midnight; Prisma converts a JS Date to UTC before truncating it for a
 * `DATE` column; and in IST local midnight on the 2nd is 18:30 UTC on the 1st.
 * The raw `pg` driver binds a Date using the local zone and gets this right,
 * which is why a direct SQL probe could not reproduce it and only a Prisma
 * round trip could.
 *
 * These tests fix the convention rather than the symptom: a value written with
 * `toCalendarDate` must read back identically through `isoCalendarDate`, in
 * any timezone, and `startOfUtcDay` must produce something that matches it by
 * equality. The timezone cases are the point — a test that only runs in the
 * developer's own zone would have passed before the fix.
 */

import { describe, expect, it } from "vitest";

import { isoCalendarDate, isoDate, startOfUtcDay } from "@/lib/domain/calc/health";
import { toCalendarDate } from "@/lib/validation/shared";

const DATES = [
  "2026-11-02", // the date that exposed the bug
  "2026-01-01", // year boundary
  "2026-12-31",
  "2026-02-28",
  "2024-02-29", // leap day
  "2026-03-15",
];

describe("calendar date round trip", () => {
  it.each(DATES)("%s survives write then read", (picked) => {
    expect(isoCalendarDate(toCalendarDate(picked))).toBe(picked);
  });

  it("writes UTC midnight, not local midnight", () => {
    /* The whole fix in one assertion: the instant handed to the driver must
       be midnight *UTC*, because that is the only part Prisma keeps. */
    expect(toCalendarDate("2026-11-02").toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("does not shift the day for a zone east of Greenwich", () => {
    /* IST is UTC+5:30 — the zone this product is built for, and the one the
       original bug appeared in. Local getters on this value would say the 1st. */
    const value = toCalendarDate("2026-11-02");
    expect(value.getUTCDate()).toBe(2);
    expect(isoCalendarDate(value)).toBe("2026-11-02");
  });
});

describe("startOfUtcDay", () => {
  it("matches what toCalendarDate would have written for the same day", () => {
    /* This is the equality-filter contract. A meal logged today is found by
       today's query only if these two agree exactly. */
    const noon = new Date(2026, 10, 2, 12, 30, 0);
    expect(startOfUtcDay(noon).getTime()).toBe(toCalendarDate("2026-11-02").getTime());
  });

  it("uses the local day, not the UTC day, to decide which date it is", () => {
    /* Late evening local time is already tomorrow in UTC for zones east of
       Greenwich. The day belongs to the user, so it must still be the 2nd. */
    const lateEvening = new Date(2026, 10, 2, 23, 45, 0);
    expect(isoCalendarDate(startOfUtcDay(lateEvening))).toBe("2026-11-02");
  });

  it("is idempotent", () => {
    const once = startOfUtcDay(new Date(2026, 10, 2, 8, 0, 0));
    expect(startOfUtcDay(once).getTime()).toBe(once.getTime());
  });
});

describe("isoDate stays local, for timestamps", () => {
  it("formats a moment by the local day it falls on", () => {
    /* isoDate is for `new Date()` and `createdAt`, where the question is
       "what day is it for this person", not "what calendar date was stored".
       Keeping the two functions apart is what lets both be correct. */
    const localNoon = new Date(2026, 10, 2, 12, 0, 0);
    expect(isoDate(localNoon)).toBe("2026-11-02");
  });

  it("reads local components where isoCalendarDate reads UTC ones", () => {
    /* One instant, two correct answers, because the questions differ.
       Constructed from an explicit UTC moment so the case is the same
       everywhere; the expectations are derived from the Date itself rather
       than hard-coded, so this asserts *which component set* each function
       uses rather than assuming the test machine's zone. */
    const instant = new Date(Date.UTC(2026, 10, 1, 20, 30));

    const localExpected = [
      instant.getFullYear(),
      `${instant.getMonth() + 1}`.padStart(2, "0"),
      `${instant.getDate()}`.padStart(2, "0"),
    ].join("-");

    expect(isoDate(instant)).toBe(localExpected);
    expect(isoCalendarDate(instant)).toBe("2026-11-01");
  });
});
