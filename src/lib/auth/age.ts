/**
 * The age gate.
 *
 * Date of birth is asked before anything else on signup, and no account is
 * created until it clears. Kept as pure functions so the signup form and the
 * server action reach the same verdict from the same input — a gate that only
 * runs in the browser is not a gate.
 */

export type AgeVerdict =
  /** Under 13: no account, and we say so kindly. */
  | { outcome: "blocked-child"; age: number }
  /** 13–17: no account until parental consent exists, per the product spec. */
  | { outcome: "blocked-minor"; age: number }
  | { outcome: "allowed"; age: number }
  | { outcome: "invalid"; reason: string };

/** Full years elapsed, counting the month and day rather than just the year. */
export function ageOn(dob: Date, on: Date = new Date()): number {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = on.getUTCMonth() - dob.getUTCMonth();

  if (monthDelta < 0 || (monthDelta === 0 && on.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }

  return age;
}

/** Oldest plausible account holder. Anything older is a typo, not a person. */
const MAX_AGE = 120;

export function checkAge(dobInput: string | Date, on: Date = new Date()): AgeVerdict {
  const dob = typeof dobInput === "string" ? parseDob(dobInput) : dobInput;

  if (!dob || Number.isNaN(dob.getTime())) {
    return { outcome: "invalid", reason: "Enter your date of birth as YYYY-MM-DD." };
  }

  if (dob.getTime() > on.getTime()) {
    return { outcome: "invalid", reason: "That date is in the future." };
  }

  const age = ageOn(dob, on);

  if (age > MAX_AGE) {
    return { outcome: "invalid", reason: "Check the year — that date looks like a typo." };
  }

  if (age < 13) return { outcome: "blocked-child", age };
  if (age < 18) return { outcome: "blocked-minor", age };

  return { outcome: "allowed", age };
}

/**
 * Parses the `YYYY-MM-DD` a date input produces, as UTC midnight. Using the
 * Date constructor directly would read it in local time and shift the day
 * backwards for anyone east of UTC — which is where most of our users are.
 */
export function parseDob(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );

  // Rejects 2025-02-30, which Date would silently roll into March.
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return date;
}

/**
 * Safety rules that depend on age rather than on a setting. Both are product
 * requirements, not preferences, so they live next to the gate.
 */
export function ageSafety(age: number) {
  return {
    /** Under 20s get BMI-for-age percentiles, which need sex, not adult BMI. */
    usesBmiForAge: age < 20,
    /** No weight-loss targets and no calorie goals under 20. */
    allowsWeightTargets: age >= 20,
    allowsCalorieTargets: age >= 20,
  };
}
