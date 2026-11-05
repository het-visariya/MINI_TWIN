/**
 * The contract a food-vision provider's reply has to satisfy.
 *
 * This is the trust boundary for model output. A vision LLM asked for JSON
 * will usually return JSON, and will occasionally return JSON wrapped in a
 * fenced code block, or a number as a string, or one extra field, or 400 items
 * because the prompt leaked. None of that may reach the database or the
 * screen, so every reply is parsed through here before anything else looks at
 * it, and a reply that fails becomes an honest "couldn't read this" rather
 * than a crash or a silently half-populated meal.
 *
 * Macros are clamped rather than merely validated: a model that says a roti is
 * 900 kcal is wrong in a way the user should be allowed to correct, but a model
 * that says 9,000,000 is malfunctioning, and a number that large would wreck
 * every total on the screen before anyone noticed.
 */

import { z } from "zod";

/** Per-portion, not per 100 g. Generous ceilings — one plate, not one day. */
const macro = (max: number) =>
  z.coerce
    .number()
    .finite()
    .min(0)
    .max(max)
    /* Models like to emit 12.800000000000001. Nothing here is precise enough
       to deserve more than one decimal, and the UI rounds anyway. */
    .transform((value) => Math.round(value * 10) / 10);

export const detectedFoodSchema = z.object({
  name: z.string().trim().min(1).max(120),

  /* Free text by design — "1 katori", "2 medium", "half plate". Required, so
     a number can never be shown without the portion it refers to. */
  portion: z.string().trim().min(1).max(80),

  estKcal: macro(5_000),
  estProteinG: macro(500),
  estCarbsG: macro(1_000),
  estFatG: macro(500),

  /* Some models answer 0-100 instead of 0-1 however firmly the prompt asks.
     Both are accepted and normalised, because rejecting the reply over a
     scale convention would throw away a usable reading of the plate. */
  confidence: z.coerce
    .number()
    .finite()
    .min(0)
    .max(100)
    .transform((value) => (value > 1 ? value / 100 : value)),
});

export const foodAnalysisSchema = z.object({
  /* A photo with nothing recognisable is a valid reply, and is handled as low
     confidence upstream rather than as an error. The ceiling stops a prompt
     injection or a runaway generation from producing a 500-row meal. */
  items: z.array(detectedFoodSchema).max(25),

  assumptions: z.array(z.string().trim().min(1).max(240)).max(12).default([]),
});

export type DetectedFoodPayload = z.infer<typeof detectedFoodSchema>;
export type FoodAnalysisPayload = z.infer<typeof foodAnalysisSchema>;

/**
 * Pull the JSON object out of whatever the model actually sent.
 *
 * Kept separate from the schema so the two failure modes stay distinguishable:
 * "that was not JSON" and "that was JSON of the wrong shape" want different
 * messages in `MealPhoto.failureNote`, and a provider that regresses on one
 * should not look like it regressed on the other.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();

  /* ```json … ``` — common even with a response schema set. */
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/u.exec(trimmed);
  const body = fenced ? fenced[1] : trimmed;

  try {
    return JSON.parse(body);
  } catch {
    /* Last resort: the first balanced-looking object in a reply that came with
       a sentence of preamble. Deliberately not a parser — if this does not
       work, the reply is treated as unreadable. */
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start === -1 || end <= start) return null;

    try {
      return JSON.parse(body.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/** The upload the browser sends. Bounds come from the bucket's own limits. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const analyzeRequestSchema = z.object({
  mealType: z.enum(["BREAKFAST", "LUNCH", "SNACK", "DINNER"]).optional(),
});
