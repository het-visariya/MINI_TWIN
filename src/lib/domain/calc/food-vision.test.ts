/**
 * Tests for the two places a food-vision provider can do damage: the schema
 * that model output has to survive, and the mapper that turns it into rows
 * destined for someone's health record.
 *
 * The cases here are the misbehaviours actually seen from vision LLMs asked
 * for JSON — fenced output, confidence on the wrong scale, float noise, a
 * preamble sentence — plus the invariant that matters most: a photo-derived
 * row is an estimate, and nothing can talk it out of being one.
 */

import { describe, expect, it } from "vitest";

import { analysisToDraft, confidenceLabel } from "@/lib/domain/calc/food-vision";
import type { FoodAnalysis } from "@/lib/integrations/food-vision";
import type { FoodRef } from "@/lib/domain/calc/nutrition";
import { extractJson, foodAnalysisSchema } from "@/lib/validation/food-vision";

const foods: FoodRef[] = [
  {
    id: "food-dal",
    name: "Dal",
    aliases: ["daal", "dal tadka"],
    servingLabel: "1 katori",
    servingGrams: 150,
    kcal: 120,
    proteinG: 7,
    carbsG: 18,
    fatG: 3,
    fibreG: 4,
    source: "IFCT 2017",
  },
];

function analysis(partial: Partial<FoodAnalysis> = {}): FoodAnalysis {
  return {
    provider: "gemini",
    assumptions: [],
    items: [
      {
        name: "Dal",
        portion: "1 katori",
        estKcal: 130,
        estProteinG: 7.5,
        estCarbsG: 19,
        estFatG: 3.5,
        confidence: 0.9,
      },
    ],
    ...partial,
  };
}

describe("extractJson", () => {
  it("reads a bare JSON object", () => {
    expect(extractJson('{"items":[]}')).toEqual({ items: [] });
  });

  it("unwraps a fenced code block, which models emit even when told not to", () => {
    expect(extractJson('```json\n{"items":[]}\n```')).toEqual({ items: [] });
  });

  it("unwraps a fence with no language tag", () => {
    expect(extractJson('```\n{"items":[]}\n```')).toEqual({ items: [] });
  });

  it("salvages an object that came with a sentence of preamble", () => {
    expect(extractJson('Sure! Here is the analysis: {"items":[]} Hope that helps.')).toEqual({
      items: [],
    });
  });

  it("returns null rather than throwing on prose", () => {
    expect(extractJson("I cannot see any food in this image.")).toBeNull();
  });
});

describe("foodAnalysisSchema", () => {
  it("normalises confidence given on a 0-100 scale", () => {
    const parsed = foodAnalysisSchema.parse({
      items: [
        {
          name: "Dal",
          portion: "1 katori",
          estKcal: 130,
          estProteinG: 7,
          estCarbsG: 19,
          estFatG: 3,
          confidence: 90,
        },
      ],
    });

    expect(parsed.items[0].confidence).toBeCloseTo(0.9);
  });

  it("leaves a 0-1 confidence alone", () => {
    const parsed = foodAnalysisSchema.parse({
      items: [
        {
          name: "Dal",
          portion: "1 katori",
          estKcal: 130,
          estProteinG: 7,
          estCarbsG: 19,
          estFatG: 3,
          confidence: 0.9,
        },
      ],
    });

    expect(parsed.items[0].confidence).toBeCloseTo(0.9);
  });

  it("trims float noise off macros", () => {
    const parsed = foodAnalysisSchema.parse({
      items: [
        {
          name: "Dal",
          portion: "1 katori",
          estKcal: 130.00000000000003,
          estProteinG: 7.800000000000001,
          estCarbsG: 19,
          estFatG: 3,
          confidence: 0.9,
        },
      ],
    });

    expect(parsed.items[0].estKcal).toBe(130);
    expect(parsed.items[0].estProteinG).toBe(7.8);
  });

  it("rejects a macro beyond what one plate could hold", () => {
    const result = foodAnalysisSchema.safeParse({
      items: [
        {
          name: "Dal",
          portion: "1 katori",
          estKcal: 9_000_000,
          estProteinG: 7,
          estCarbsG: 19,
          estFatG: 3,
          confidence: 0.9,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a reply with no portion, so a number is never shown bare", () => {
    const result = foodAnalysisSchema.safeParse({
      items: [
        {
          name: "Dal",
          portion: "",
          estKcal: 130,
          estProteinG: 7,
          estCarbsG: 19,
          estFatG: 3,
          confidence: 0.9,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("accepts an empty reading, which is a result and not an error", () => {
    const parsed = foodAnalysisSchema.parse({ items: [] });
    expect(parsed.items).toEqual([]);
    expect(parsed.assumptions).toEqual([]);
  });

  it("refuses a runaway generation", () => {
    const one = {
      name: "Dal",
      portion: "1 katori",
      estKcal: 1,
      estProteinG: 1,
      estCarbsG: 1,
      estFatG: 1,
      confidence: 0.5,
    };

    expect(foodAnalysisSchema.safeParse({ items: Array(26).fill(one) }).success).toBe(false);
  });
});

describe("analysisToDraft", () => {
  it("marks every row an estimate even when the name matches the food table", () => {
    const draft = analysisToDraft(analysis(), foods);

    expect(draft.items).toHaveLength(1);
    expect(draft.items[0].isEstimate).toBe(true);
    expect(draft.items[0].matchedName).toBe("Dal");
  });

  it("keeps the provider's macros rather than the food table's", () => {
    /* The table says 120 kcal for a katori of dal; the provider looked at this
       plate and said 130. The photo is the point, so 130 must survive. */
    const draft = analysisToDraft(analysis(), foods);

    expect(draft.items[0].kcal).toBe(130);
  });

  it("puts the portion in the label, and leaves quantity at one", () => {
    const draft = analysisToDraft(analysis(), foods);

    expect(draft.items[0].label).toBe("Dal (1 katori)");
    /* Double-counting guard: the portion is already in the label and in the
       macros, so a quantity multiplier here would apply it twice. */
    expect(draft.items[0].quantity).toBe(1);
  });

  it("still produces a row when nothing in the food table matches", () => {
    const draft = analysisToDraft(
      analysis({
        items: [
          {
            name: "Thukpa",
            portion: "1 bowl",
            estKcal: 310,
            estProteinG: 12,
            estCarbsG: 40,
            estFatG: 9,
            confidence: 0.8,
          },
        ],
      }),
      foods,
    );

    expect(draft.items[0].matchedName).toBeNull();
    expect(draft.items[0].foodId).toBeNull();
    expect(draft.items[0].kcal).toBe(310);
    expect(draft.items[0].isEstimate).toBe(true);
  });

  it("flags an empty reading as unreliable", () => {
    const draft = analysisToDraft(analysis({ items: [] }), foods);

    expect(draft.unreliable).toBe(true);
    expect(draft.confidence).toBe(0);
  });

  it("flags a barely-guessed reading as unreliable", () => {
    const draft = analysisToDraft(
      analysis({
        items: [
          {
            name: "Something beige",
            portion: "1 plate",
            estKcal: 200,
            estProteinG: 5,
            estCarbsG: 30,
            estFatG: 5,
            confidence: 0.2,
          },
        ],
      }),
      foods,
    );

    expect(draft.unreliable).toBe(true);
    expect(draft.items[0].lowConfidence).toBe(true);
  });

  it("does not flag a confident reading", () => {
    expect(analysisToDraft(analysis(), foods).unreliable).toBe(false);
  });

  it("carries the provider's assumptions through for display", () => {
    const draft = analysisToDraft(
      analysis({ assumptions: ["Assumed about a teaspoon of oil in the dal."] }),
      foods,
    );

    expect(draft.assumptions).toEqual(["Assumed about a teaspoon of oil in the dal."]);
  });
});

describe("confidenceLabel", () => {
  it("bands without implying precision", () => {
    expect(confidenceLabel(0.2)).toBe("Low");
    expect(confidenceLabel(0.6)).toBe("Medium");
    expect(confidenceLabel(0.95)).toBe("High");
  });
});
