/**
 * Reminder and notification input schemas.
 *
 * The daily cap is bounded at 10 rather than left open. The product's promise
 * is that it does not spam, and a field that accepts 500 is a field that
 * eventually holds 500.
 */

import { z } from "zod";

import { optionalText } from "@/lib/validation/shared";

export const reminderKind = z.enum([
  "DEADLINE",
  "ATTENDANCE",
  "WORKOUT",
  "WATER",
  "WEEKLY_REVIEW",
  "CUSTOM",
]);

export const reminderChannel = z.enum(["IN_APP", "EMAIL", "BOTH"]);

const hour = z.coerce
  .number()
  .int()
  .min(0, "Pick an hour from 0 to 23.")
  .max(23, "Pick an hour from 0 to 23.");

export const notificationPrefsSchema = z.object({
  quietHoursStart: hour.default(22),
  quietHoursEnd: hour.default(7),
  dailyCap: z.coerce
    .number()
    .int()
    .min(0, "A cap cannot be negative.")
    .max(10, "This app does not send more than ten a day.")
    .default(3),
  emailEnabled: z.coerce.boolean().default(false),
  /** IANA zone. Validated against the platform rather than a hand-kept list. */
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .default("Asia/Kolkata")
    .refine(isValidTimeZone, "That is not a time zone this app recognises."),
});

export const reminderRuleSchema = z.object({
  kind: reminderKind,
  enabled: z.coerce.boolean().default(true),
  leadMinutes: z.coerce
    .number()
    .int()
    .min(0, "A lead time cannot be negative.")
    .max(7 * 24 * 60, "A week ahead is as far as this app reminds you.")
    .default(60),
  channel: reminderChannel.default("IN_APP"),
  label: optionalText(80),
});

export const toggleRuleSchema = z.object({
  ruleId: z.string().trim().min(1),
  enabled: z.coerce.boolean(),
});

export const deleteRuleSchema = z.object({ ruleId: z.string().trim().min(1) });

export const markReadSchema = z.object({
  notificationId: z.string().trim().min(1),
});

function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>;
export type ReminderRuleInput = z.infer<typeof reminderRuleSchema>;
