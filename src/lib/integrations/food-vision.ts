/**
 * Reading a plate of food from a photograph, behind a provider interface.
 *
 * Nothing here trains or ships a model. There are two candidate providers —
 * a vision LLM with a strict JSON contract, and LogMeal's specialist food API
 * — and the point of this file is that choosing between them, or replacing
 * both later, touches only `getFoodVision()`.
 *
 * Two properties matter more than accuracy:
 *
 *   - **Everything this returns is an estimate.** A photo cannot show what is
 *     in the oil, how much ghee went in, or whether the dal was thinned. The
 *     numbers are labelled as estimates in the type, stored as estimates in
 *     the row, and shown as estimates in the UI for as long as the row lives.
 *     There is no path by which a photo-derived number loses that label.
 *   - **A provider failure is a normal outcome, not an exception.** `analyze`
 *     resolves with `ok: false` instead of throwing, because "I couldn't read
 *     this" is an answer the user needs to see, and because a vision outage
 *     must never be able to block the manual log.
 */

/** How sure the provider is about one row, 0–1. Drives the confidence chip. */
export type Confidence = number;

/**
 * One food the provider believes it saw.
 *
 * `portion` is free text ("1 katori", "2 medium") rather than grams, because
 * that is what a vision model can honestly offer and what a user can check at
 * a glance. The macros are per the stated portion, not per 100 g.
 */
export type DetectedFood = {
  name: string;
  portion: string;
  estKcal: number;
  estProteinG: number;
  estCarbsG: number;
  estFatG: number;
  confidence: Confidence;
};

/**
 * What the provider assumed in order to produce a number at all.
 *
 * Kept and shown, not discarded. "Assumed the dal was cooked in about a
 * teaspoon of oil" is the difference between a number the user can correct and
 * a number they have to take on faith.
 */
export type FoodAnalysis = {
  items: DetectedFood[];
  assumptions: string[];
  /** Which provider produced this, recorded on every row it becomes. */
  provider: FoodVisionProviderKind;
};

export type FoodVisionProviderKind = "null" | "gemini" | "logmeal";

/** What we tell the provider about the eater, so the guess is less generic. */
export type FoodVisionHints = {
  /** Steers portion assumptions; this app's users eat mostly Indian food. */
  cuisine?: "indian" | "generic";
  /**
   * Declared diet. A hint only — never a filter. If the photo shows chicken
   * and the profile says vegetarian, the provider should report the chicken:
   * the user is owed the truth about their own plate, and the allergy and diet
   * warnings downstream are what act on the mismatch.
   */
  dietType?: string;
  mealType?: string;
};

export type FoodVisionResult =
  | { ok: true; analysis: FoodAnalysis }
  | {
      ok: false;
      /**
       * Shown to the user verbatim, so it is written for them and not for a
       * log file. Never contains provider internals or a stack trace.
       */
      reason: string;
      /** For `MealPhoto.failureNote`; may name the provider and status. */
      detail?: string;
    };

export interface FoodVision {
  readonly kind: FoodVisionProviderKind;
  analyze(imageBytes: Uint8Array, hints: FoodVisionHints): Promise<FoodVisionResult>;
}

/**
 * The provider used when none is configured.
 *
 * It does not pretend. Rather than inventing plausible dal, it reports that it
 * cannot read photos, which routes the user to the manual composer — the same
 * place a real provider's failure would send them. That makes the unconfigured
 * path exercise exactly the code the configured path falls back to, so the
 * fallback is tested every time anyone uses the app without a key.
 */
export const nullFoodVision: FoodVision = {
  kind: "null",

  async analyze() {
    return {
      ok: false,
      reason: "Photo reading is not switched on yet — you can still type this meal in.",
      detail: "no food-vision provider configured",
    };
  },
};

/**
 * Which provider to use.
 *
 * TODO(het): need the food-vision provider decision (§9). Gemini vision reuses
 * GEMINI_API_KEY and needs no new account; LogMeal needs LOGMEAL_API_KEY and
 * is a specialist model with better dish-level recall. Until you pick one,
 * this returns the null provider and the photo button stays hidden, so the
 * screen never offers something that cannot work.
 */
export function getFoodVision(): FoodVision {
  return nullFoodVision;
}

/**
 * True when photos can actually be read.
 *
 * The capture control is hidden on false rather than disabled: a disabled
 * camera button invites the user to wonder what they did wrong, where its
 * absence simply means the feature is not here yet.
 */
export function foodVisionConnected(): boolean {
  return getFoodVision().kind !== "null";
}

/** The `MealItemSource` that rows from this provider are stored under. */
export function sourceForProvider(
  kind: FoodVisionProviderKind,
): "MANUAL" | "PHOTO_GEMINI" | "PHOTO_LOGMEAL" {
  if (kind === "gemini") return "PHOTO_GEMINI";
  if (kind === "logmeal") return "PHOTO_LOGMEAL";

  /* The null provider never produces items, so this branch is unreachable in
     practice. MANUAL is the safe answer anyway: it claims no provenance. */
  return "MANUAL";
}

/**
 * Below this, the provider is saying "I think, but I would not bet".
 *
 * At or under it the UI leads with "couldn't read this clearly" and offers the
 * manual composer, instead of presenting a row that looks authoritative.
 */
export const LOW_CONFIDENCE = 0.45;
