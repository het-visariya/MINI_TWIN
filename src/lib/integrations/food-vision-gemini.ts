/**
 * Reading a plate with Gemini.
 *
 * Talks to the REST endpoint directly rather than through a client library:
 * this is one POST with an inline image, and a dependency would add a version
 * to keep pinned for nothing we use.
 *
 * Two things make the output usable rather than merely plausible:
 *
 *   - **The model is given a response schema**, not just asked nicely for
 *     JSON. Prose, a fenced block or a missing field all become parse errors
 *     the user never sees, and `extractJson` still unwraps a fence because
 *     models occasionally emit one even with a schema set.
 *   - **The prompt pins the portion vocabulary to Indian servings** — katori,
 *     roti, idli — because "one serving" means nothing when the plate is dal
 *     and the model's default is a US restaurant portion.
 *
 * Everything it returns is an estimate, and is labelled as one for the life of
 * the row. A photo cannot show the ghee.
 */

import type {
  FoodVision,
  FoodVisionHints,
  FoodVisionResult,
} from "@/lib/integrations/food-vision";
import { extractJson, foodAnalysisSchema } from "@/lib/validation/food-vision";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Beyond this the request is abandoned; the user gets the manual composer. */
const TIMEOUT_MS = 30_000;

/** Extra attempts after the first, for a busy model only. */
const RETRIES = 2;
const RETRY_BACKOFF_MS = 1_200;

/**
 * The shape the model must answer in.
 *
 * Declared as an OpenAPI-subset schema so the API enforces it server-side.
 * `required` matters more than the types here: an item without a portion
 * would put a calorie count on screen with nothing to check it against.
 */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          portion: { type: "STRING" },
          estKcal: { type: "NUMBER" },
          estProteinG: { type: "NUMBER" },
          estCarbsG: { type: "NUMBER" },
          estFatG: { type: "NUMBER" },
          confidence: { type: "NUMBER" },
        },
        required: [
          "name",
          "portion",
          "estKcal",
          "estProteinG",
          "estCarbsG",
          "estFatG",
          "confidence",
        ],
      },
    },
    assumptions: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["items", "assumptions"],
} as const;

function prompt(hints: FoodVisionHints): string {
  const cuisine =
    hints.cuisine === "indian"
      ? "The food is most likely Indian home or canteen food. Use Indian serving units the eater will recognise: 1 katori, 1 roti, 2 idli, 1 plate, 1 bowl, 1 glass."
      : "Use everyday serving units the eater will recognise.";

  return [
    "You are estimating the nutrition of a meal from a photograph.",
    "",
    cuisine,
    "",
    "Rules:",
    "- List each distinct food you can see as its own item. Do not merge a thali into one row.",
    "- `portion` must describe the amount you actually see on the plate, not a standard serving.",
    "- Macros are for that portion, not per 100 g.",
    "- `confidence` is 0 to 1: how sure you are this is that food in that amount.",
    "- Use a LOW confidence when the dish is ambiguous, partly hidden, or could be one of several similar dishes. Guessing confidently is worse than admitting doubt.",
    "- If you cannot identify any food, return an empty items array. Do not invent a meal.",
    "- In `assumptions`, state anything you had to assume that materially changes the numbers: cooking oil, ghee, sugar in a drink, whether a curry is cream-based. Write them for the eater, in plain words.",
    "",
    /* Said explicitly because a model told to be helpful will otherwise omit
       a food it thinks the eater did not mean to include. The eater is owed
       the truth about their own plate; the diet and allergy warnings
       downstream are what act on a mismatch. */
    "Report everything you see, even if it seems inconsistent with a vegetarian or restricted diet. Do not omit or soften an item to be agreeable.",
    hints.dietType ? `(For context only, never a filter: the eater's stated diet is ${hints.dietType}.)` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function geminiFoodVision(apiKey: string, model: string): FoodVision {
  /** One attempt. Never throws: every failure becomes a FoodVisionResult. */
  async function once(
    imageBytes: Uint8Array,
    hints: FoodVisionHints,
  ): Promise<FoodVisionResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          /* Header, not a query parameter: a key in a URL ends up in logs and
             proxy histories. */
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt(hints) },
                { inlineData: { mimeType: "image/jpeg", data: toBase64(imageBytes) } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            /* Low, not zero: this is an estimate, but it should be the same
               estimate for the same plate twice running. */
            temperature: 0.2,
          },
        }),
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);

        if (response.status === 429) {
          return {
            ok: false,
            reason: "The food reader is busy right now — try again shortly, or type the meal in.",
            detail: `gemini 429: ${detail}`,
          };
        }

        return {
          ok: false,
          reason: "Couldn't read this photo. You can still type the meal in.",
          detail: `gemini ${response.status}: ${detail}`,
        };
      }

      const payload = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };

      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        return {
          ok: false,
          reason: "Couldn't read this clearly — add it manually?",
          detail: "gemini returned no text part",
        };
      }

      const parsed = foodAnalysisSchema.safeParse(extractJson(text));
      if (!parsed.success) {
        return {
          ok: false,
          reason: "Couldn't read this clearly — add it manually?",
          detail: `reply failed validation: ${parsed.error.message.slice(0, 200)}`,
        };
      }

      if (parsed.data.items.length === 0) {
        return {
          ok: false,
          reason: "No food recognised in that photo — try a clearer one, or type the meal in.",
          detail: "gemini found no items",
        };
      }

      return {
        ok: true,
        analysis: {
          items: parsed.data.items,
          assumptions: parsed.data.assumptions,
          provider: "gemini",
        },
      };
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";

      return {
        ok: false,
        reason: aborted
          ? "That took too long to read. Try again, or type the meal in."
          : "Couldn't reach the food reader. You can still type the meal in.",
        detail: error instanceof Error ? error.message : "unknown error",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    kind: "gemini",

    /*
     * 503 is retried; nothing else is.
     *
     * Gemini answers "This model is currently experiencing high demand" with
     * a 503 often enough that one attempt makes the feature look broken when
     * it is merely busy — four of five flash models returned it within the
     * same minute during testing. A 4xx is the request's own fault and would
     * fail identically, so only this one earns another go, and only twice,
     * because someone is waiting on it with a photo on screen.
     */
    async analyze(imageBytes, hints): Promise<FoodVisionResult> {
      for (let attempt = 0; ; attempt += 1) {
        const result = await once(imageBytes, hints);

        const busy = !result.ok && result.detail?.startsWith("gemini 503");
        if (!busy || attempt >= RETRIES) return result;

        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_BACKOFF_MS * (attempt + 1)),
        );
      }
    },
  };
}
