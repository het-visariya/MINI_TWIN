/**
 * Pieces every module's schemas reuse.
 *
 * Bounds here are not decoration. A server action is a public endpoint: the
 * form is a convenience, and anything that reaches the database has to survive
 * a hand-written POST. So every numeric field states a range, every string a
 * maximum length, and every date a plausible window.
 */

import { z } from "zod";

/** A cuid from our own tables. Narrow enough to reject a probing id. */
export const id = z.string().trim().min(1).max(64);

/** Short free text: a label, a name, an exercise. */
export const shortText = (max = 120) => z.string().trim().min(1).max(max);

export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

/**
 * A calendar date as yyyy-mm-dd.
 *
 * Parsed as local midnight rather than through `new Date(string)`, which
 * reads a bare date as UTC and so lands on the previous day for anyone east of
 * Greenwich — including every user this product is built for.
 */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in the form yyyy-mm-dd.")
  .refine((value) => !Number.isNaN(toLocalDate(value).getTime()), "That is not a real date.")
  .transform(toLocalDate);

export function toLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Dates the product will accept at all: 1900 to a century out. */
export const boundedDate = isoDate.refine(
  (date) => date.getFullYear() >= 1900 && date.getFullYear() <= 2126,
  "That date is outside the range this app works with.",
);

/** Rupees as typed, converted to the paise integer the database stores. */
export const rupeesToMinor = z.coerce
  .number()
  .min(0, "An amount cannot be negative.")
  .max(100_000_000, "That is larger than this app handles.")
  .transform((rupees) => Math.round(rupees * 100));

/** A 1-5 self-rating. */
export const level = z.coerce.number().int().min(1).max(5);

/** Checkbox posted by a form: "on", "true", "1" or absent. */
export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.boolean(), z.undefined()])
  .transform((value) => value === "on" || value === "true" || value === "1" || value === true);

/**
 * FormData to a plain object.
 *
 * Repeated keys collapse into an array, which is how a multi-select and a set
 * of checkboxes with the same name arrive. Empty strings become undefined so
 * that `.optional()` behaves the way the form author expects.
 */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, raw] of formData.entries()) {
    const value = typeof raw === "string" ? raw : undefined;
    if (value === undefined) continue;

    if (key in out) {
      const existing = out[key];
      out[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
      continue;
    }

    out[key] = value === "" ? undefined : value;
  }

  return out;
}

/** Comma- or newline-separated free text to a trimmed, de-duplicated list. */
export const stringList = (max = 20) =>
  z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) =>
      value
        ? [
            ...new Set(
              value
                .split(/[,\n]/)
                .map((part) => part.trim())
                .filter((part) => part.length > 0),
            ),
          ].slice(0, max)
        : [],
    );

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Zod issues to the shape the forms render.
 *
 * `error` is the one-line message for the toast; `fieldErrors` is what gets
 * shown inline. The raw issue text is never exposed beyond this — a client
 * should never see a Prisma or Zod internal.
 */
export function invalid(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    fieldErrors[key] ??= issue.message;
  }

  return {
    ok: false,
    error: "Some of those details need another look.",
    fieldErrors,
  };
}
