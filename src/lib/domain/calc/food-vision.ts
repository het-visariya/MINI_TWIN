/**
 * Turning a provider's reading of a photo into the same draft the typed
 * composer produces.
 *
 * This is the hinge of the whole photo feature. By mapping onto `DraftItem`,
 * the photo path inherits the confirm step, the editable rows, the allergy
 * gate and the `logMeal` action that the typed path already has — rather than
 * growing a second way to write a meal that would have to be kept in step with
 * the first. The consequences are worth stating plainly:
 *
 *   - Nothing reaches `MealLog` until the user submits the confirm form, which
 *     is the same form, with the same server-side allergy refusal.
 *   - A photo-derived row cannot bypass a declared allergen, because the check
 *     runs on the draft and not on the provider's reply.
 *
 * Pure: no database, no clock, no provider. Takes a parsed analysis and the
 * food table, returns rows.
 */

import { matchFood, round, type DraftItem, type FoodRef } from "@/lib/domain/calc/nutrition";
import { LOW_CONFIDENCE, type DetectedFood, type FoodAnalysis } from "@/lib/integrations/food-vision";

/** A draft row plus the provenance the confirm screen needs to show. */
export type PhotoDraftItem = DraftItem & {
  confidence: number;
  /** The provider's own words for the amount: "1 katori", "2 medium". */
  portion: string;
  /** True when this single row is shakier than the rest. */
  lowConfidence: boolean;
};

export type PhotoDraft = {
  items: PhotoDraftItem[];
  assumptions: string[];
  /**
   * True when the reading as a whole is not worth presenting as a result —
   * nothing found, or everything found barely guessed at. The UI leads with
   * "couldn't read this clearly" and offers typing instead.
   */
  unreliable: boolean;
  /** Mean confidence across rows, 0 when there are none. */
  confidence: number;
};

/**
 * Map an analysis onto draft rows.
 *
 * The provider's macros are kept rather than replaced with the food table's,
 * even when the name matches a table row. The table knows what one standard
 * katori of dal contains; the provider is looking at *this* plate and has
 * already accounted for the portion it can see. Overwriting its numbers with
 * table values would discard the only thing the photo contributed.
 *
 * The table is still consulted, for two things that are not the macros:
 * `foodId`/`matchedName`, which is what the allergy check reads, and
 * `servingLabel`, which lets the row display a familiar unit.
 */
export function analysisToDraft(analysis: FoodAnalysis, foods: FoodRef[]): PhotoDraft {
  const items = analysis.items.map((detected) => toDraftItem(detected, foods));

  const confidence =
    items.length === 0
      ? 0
      : items.reduce((sum, item) => sum + item.confidence, 0) / items.length;

  return {
    items,
    assumptions: analysis.assumptions,
    /* Empty is unreliable too: "I found no food" and "I found food I cannot
       name" are the same outcome for the person holding the phone. */
    unreliable: items.length === 0 || confidence < LOW_CONFIDENCE,
    confidence: round(confidence, 2),
  };
}

function toDraftItem(detected: DetectedFood, foods: FoodRef[]): PhotoDraftItem {
  /* Matched on the name alone. The portion is deliberately excluded: it is
     free text like "half plate", and feeding it to a quantity parser built for
     typed input would invent a multiplier nobody asked for. */
  const matched = matchFood(detected.name, foods);

  return {
    /* The provider's name and portion together, because that pair is what the
       user has to check against the plate they just photographed. A bare
       "Dal" invites a glance and a tap; "Dal (1 katori)" invites a correction
       when the katori was bigger than that. */
    label: `${detected.name} (${detected.portion})`,
    foodId: matched?.id ?? null,
    matchedName: matched?.name ?? null,

    /* One serving of what the provider described. The portion lives in the
       label, so a second multiplier here would double-count it. */
    quantity: 1,

    kcal: round(detected.estKcal),
    proteinG: round(detected.estProteinG, 1),
    carbsG: round(detected.estCarbsG, 1),
    fatG: round(detected.estFatG, 1),

    /* Non-negotiable. Every number derived from a photograph is an estimate,
       whether or not the name happened to match a table row, and this flag is
       what carries that onto the stored row and into the UI. */
    isEstimate: true,

    servingLabel: matched?.servingLabel ?? null,

    confidence: round(detected.confidence, 2),
    portion: detected.portion,
    lowConfidence: detected.confidence < LOW_CONFIDENCE,
  };
}

/** Wording for the confidence chip. Three bands; no false precision. */
export function confidenceLabel(confidence: number): "Low" | "Medium" | "High" {
  if (confidence < LOW_CONFIDENCE) return "Low";
  if (confidence < 0.75) return "Medium";
  return "High";
}
