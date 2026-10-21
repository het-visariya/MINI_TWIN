/**
 * Health input schemas.
 *
 * The age rule is enforced here as well as in the UI, because the UI is a
 * suggestion and this is not: `weightGoalSchema` takes the user's age and
 * refuses outright under 20. A form that forgets to hide the control is a
 * cosmetic bug; a mutation that accepts the value would be a real one.
 */

import { z } from "zod";

import { boundedDate, level, optionalText, shortText } from "@/lib/validation/shared";

export const activityLevel = z.enum([
  "SEDENTARY",
  "LIGHT",
  "MODERATE",
  "ACTIVE",
  "VERY_ACTIVE",
]);

export const healthProfileSchema = z.object({
  heightCm: z.coerce
    .number()
    .min(80, "That height is outside the range this app works with.")
    .max(250, "That height is outside the range this app works with.")
    .optional(),
  activityLevel: activityLevel.default("LIGHT"),
  plannedPerWeek: z.coerce
    .number()
    .int()
    .min(0, "Sessions a week cannot be negative.")
    .max(14, "More than two a day is beyond what this app plans for.")
    .default(3),
});

/* --------------------------------- workouts -------------------------------- */

export const workoutSetSchema = z.object({
  exercise: shortText(80),
  reps: z.coerce
    .number()
    .int()
    .min(1, "A set needs at least one rep.")
    .max(1000, "That many reps is almost certainly a typo."),
  weightKg: z.coerce
    .number()
    .min(0, "Weight cannot be negative.")
    .max(1000, "That weight is beyond what this app records.")
    .default(0),
});

export const workoutSessionSchema = z.object({
  date: boundedDate,
  notes: optionalText(500),
  sets: z
    .array(workoutSetSchema)
    .min(1, "Add at least one set.")
    .max(100, "That is more sets than one session holds."),
});

export const deleteWorkoutSchema = z.object({ sessionId: z.string().trim().min(1) });

/* ----------------------------------- body ---------------------------------- */

export const weightLogSchema = z.object({
  date: boundedDate,
  weightKg: z.coerce
    .number()
    .min(20, "That weight is outside the range this app works with.")
    .max(400, "That weight is outside the range this app works with."),
});

/**
 * A weight goal, which only exists for adults.
 *
 * `ageYears` is supplied by the server from the Profile the age gate wrote —
 * never by the client, which could claim any age it liked. Under 20 the schema
 * fails, so there is no code path that writes a weight target for a minor.
 */
export function weightGoalSchema(ageYears: number | null) {
  return z
    .object({
      targetKg: z.coerce.number().min(20).max(400),
      byDate: boundedDate.optional(),
    })
    .refine(
      () => ageYears !== null && ageYears >= 20,
      "Weight goals are not part of this app under 20.",
    );
}

/* ---------------------------------- sleep ---------------------------------- */

/** Minutes past midnight, which is what a time input gives us. */
const timeOfDay = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Use a time in the form hh:mm.")
  .transform((value) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  })
  .refine((minutes) => minutes >= 0 && minutes < 1440, "That is not a real time.");

export const sleepLogSchema = z
  .object({
    date: boundedDate,
    bedtime: timeOfDay,
    wakeTime: timeOfDay,
    quality: level.optional(),
  })
  .transform((value) => {
    /* A night that crosses midnight is the normal case, so the span is
       computed here rather than asking the user for a duration. */
    const span = value.wakeTime - value.bedtime;
    return { ...value, minutes: span >= 0 ? span : span + 1440 };
  })
  .refine(
    (value) => value.minutes >= 30 && value.minutes <= 20 * 60,
    "That is outside the range of a night's sleep this app records.",
  );

/* ---------------------------------- water ---------------------------------- */

export const waterLogSchema = z.object({
  date: boundedDate,
  ml: z.coerce
    .number()
    .int()
    .min(1, "Add at least a few millilitres.")
    .max(5000, "That is more than this app records in one entry."),
});

/* -------------------------------- check-in -------------------------------- */

export const moodCheckinSchema = z.object({
  date: boundedDate,
  mood: level,
  energy: level,
});

export type WorkoutSessionInput = z.infer<typeof workoutSessionSchema>;
export type WeightLogInput = z.infer<typeof weightLogSchema>;
export type SleepLogInput = z.infer<typeof sleepLogSchema>;
export type WaterLogInput = z.infer<typeof waterLogSchema>;
export type MoodCheckinInput = z.infer<typeof moodCheckinSchema>;
export type HealthProfileInput = z.infer<typeof healthProfileSchema>;
