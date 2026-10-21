/**
 * Privacy & control input schemas.
 *
 * The deletion phrase is a literal, checked here. A typed confirmation that
 * accepts anything is theatre, and account deletion is the one action in this
 * product that cannot be undone.
 */

import { z } from "zod";

import { optionalText } from "@/lib/validation/shared";

/** What the user must type, exactly, to delete their account. */
export const DELETE_PHRASE = "delete my twin";

export const deleteAccountSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (value) => value === DELETE_PHRASE,
      `Type "${DELETE_PHRASE}" exactly to confirm.`,
    ),
});

export const profilePreferencesSchema = z.object({
  name: z.string().trim().min(1, "Your twin needs something to call you.").max(80),
  lifeStage: z.enum(["SCHOOL", "COLLEGE", "OTHER"]).optional(),
  regreterTone: z.enum(["GENTLE", "BALANCED", "DIRECT", "NO_MERCY"]),
  theme: z.enum(["light", "dark", "system"]).default("system"),
});

export const aiConsentSchema = z.object({
  aiConsent: z.coerce.boolean().default(false),
  allowHealthDataToAi: z.coerce.boolean().default(false),
  allowMoneyDataToAi: z.coerce.boolean().default(false),
});

export const revokeSessionsSchema = z.object({
  /** Reserved for a future per-session revoke; absent means "all others". */
  sessionToken: optionalText(200),
});

export type ProfilePreferencesInput = z.infer<typeof profilePreferencesSchema>;
export type AiConsentInput = z.infer<typeof aiConsentSchema>;
