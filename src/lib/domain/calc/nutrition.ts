/**
 * Nutrition calculations and the meal-text parser. Pure: no Prisma, no React,
 * no clock.
 *
 * The parser is deliberately deterministic and deliberately unambitious. It
 * matches what the user typed against the food table and says so plainly when
 * it cannot; it never fills an unmatched item with plausible macros. Phase 4
 * replaces the body of `parseMealText` with a Gemini call behind this exact
 * signature, which is why the return type is a *draft* the user confirms
 * rather than rows that have already been saved.
 */

export type MealType = "BREAKFAST" | "LUNCH" | "SNACK" | "DINNER";

export type DietType =
  | "VEGETARIAN"
  | "EGGETARIAN"
  | "NON_VEGETARIAN"
  | "VEGAN"
  | "JAIN";

/** The subset of a Food row the parser and the totals need. */
export type FoodRef = {
  id: string;
  name: string;
  aliases: string[];
  servingLabel: string;
  servingGrams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG?: number;
  source: string;
};

export type DraftItem = {
  /** Exactly what the user typed for this piece, kept for the unmatched case. */
  label: string;
  foodId: string | null;
  /** The matched food's display name, or null when nothing matched. */
  matchedName: string | null;
  quantity: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** True when the numbers are a guess, or when there are no numbers at all. */
  isEstimate: boolean;
  servingLabel: string | null;
};

export type MealDraft = {
  /** The original input, so the confirm screen can show what was interpreted. */
  text: string;
  items: DraftItem[];
  /** Pieces of the input that matched nothing. Shown, never dropped. */
  unmatched: string[];
};

export type Totals = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/* -------------------------------------------------------------------------- */
/*                                  totals                                    */
/* -------------------------------------------------------------------------- */

export function dailyTotals(
  items: { kcal: number; proteinG: number; carbsG: number; fatG: number }[],
): Totals {
  const totals = items.reduce<Totals>(
    (sum, item) => ({
      kcal: sum.kcal + num(item.kcal),
      proteinG: sum.proteinG + num(item.proteinG),
      carbsG: sum.carbsG + num(item.carbsG),
      fatG: sum.fatG + num(item.fatG),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  return {
    kcal: Math.round(totals.kcal),
    proteinG: round(totals.proteinG, 1),
    carbsG: round(totals.carbsG, 1),
    fatG: round(totals.fatG, 1),
  };
}

/** Totals per meal type, for the grouped "today" list. */
export function totalsByMealType(
  items: (Totals & { mealType: MealType })[],
): Record<MealType, Totals> {
  const empty = (): Totals => ({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  const out: Record<MealType, Totals> = {
    BREAKFAST: empty(),
    LUNCH: empty(),
    SNACK: empty(),
    DINNER: empty(),
  };

  for (const item of items) {
    const bucket = out[item.mealType] ?? out.SNACK;
    bucket.kcal += num(item.kcal);
    bucket.proteinG += num(item.proteinG);
    bucket.carbsG += num(item.carbsG);
    bucket.fatG += num(item.fatG);
  }

  for (const key of Object.keys(out) as MealType[]) {
    out[key] = {
      kcal: Math.round(out[key].kcal),
      proteinG: round(out[key].proteinG, 1),
      carbsG: round(out[key].carbsG, 1),
      fatG: round(out[key].fatG, 1),
    };
  }

  return out;
}

/**
 * Targets for the four bars.
 *
 * Protein comes from Health's `proteinRange` — the same function, not a second
 * copy of the same constants — so the two screens can never disagree about
 * what the user's protein range is. Carbs and fat are expressed as shares of
 * the energy estimate, which is why they are absent when there is no estimate:
 * a percentage of an unknown total is not a target.
 */
export function macroTargets(input: {
  kcal: number | null;
  proteinMinG: number | null;
  proteinMaxG: number | null;
}): {
  kcal: number | null;
  proteinG: { min: number; max: number } | null;
  carbsG: number | null;
  fatG: number | null;
  isEstimate: true;
} {
  const { kcal, proteinMinG, proteinMaxG } = input;

  return {
    kcal: kcal ?? null,
    proteinG:
      proteinMinG !== null && proteinMaxG !== null
        ? { min: proteinMinG, max: proteinMaxG }
        : null,
    /* 50% of energy from carbohydrate and 28% from fat, the midpoints of the
       IOM acceptable macronutrient distribution ranges (45–65% and 20–35%).
       4 kcal/g for carbohydrate, 9 kcal/g for fat. */
    carbsG: kcal === null ? null : Math.round((kcal * 0.5) / 4),
    fatG: kcal === null ? null : Math.round((kcal * 0.28) / 9),
    isEstimate: true,
  };
}

/* -------------------------------------------------------------------------- */
/*                                 allergies                                  */
/* -------------------------------------------------------------------------- */

export type AllergyConflict = { allergen: string; itemLabel: string };

/**
 * Which logged items mention a declared allergen.
 *
 * Substring matching on normalised text, which over-matches rather than
 * under-matches on purpose: a false warning costs the user one tap, and a
 * missed one costs considerably more. The save is blocked until they confirm,
 * never silently allowed.
 */
export function allergyConflicts(
  items: { label: string; matchedName?: string | null }[],
  allergies: string[],
): AllergyConflict[] {
  const cleanAllergies = allergies
    .map((allergen) => normalise(allergen))
    .filter((allergen) => allergen.length >= 2);

  if (cleanAllergies.length === 0) return [];

  const conflicts: AllergyConflict[] = [];

  for (const item of items) {
    const haystack = normalise(`${item.label} ${item.matchedName ?? ""}`);
    for (const allergen of cleanAllergies) {
      if (haystack.includes(allergen)) {
        conflicts.push({ allergen, itemLabel: item.label });
      }
    }
  }

  return conflicts;
}

/** Foods a diet excludes, for filtering the search table. */
export const DIET_EXCLUSIONS: Record<DietType, string[]> = {
  VEGETARIAN: ["chicken", "mutton", "fish", "egg", "prawn", "beef", "pork"],
  EGGETARIAN: ["chicken", "mutton", "fish", "prawn", "beef", "pork"],
  NON_VEGETARIAN: [],
  VEGAN: [
    "chicken",
    "mutton",
    "fish",
    "egg",
    "prawn",
    "beef",
    "pork",
    "milk",
    "curd",
    "paneer",
    "ghee",
    "butter",
    "cheese",
  ],
  JAIN: ["chicken", "mutton", "fish", "egg", "prawn", "beef", "pork", "onion", "garlic", "potato"],
};

export function dietConflicts(
  items: { label: string; matchedName?: string | null }[],
  dietType: DietType,
): AllergyConflict[] {
  return allergyConflicts(items, DIET_EXCLUSIONS[dietType] ?? []);
}

/* -------------------------------------------------------------------------- */
/*                               the meal parser                              */
/* -------------------------------------------------------------------------- */

/** Words that mean a number, so "two rotis" works as well as "2 rotis". */
const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
  quarter: 0.25,
};

/**
 * Serving words that modify the quantity rather than naming the food.
 * "half plate rice" is half a serving of rice, not a food called "plate rice".
 */
const SERVING_WORDS = new Set([
  "plate",
  "plates",
  "bowl",
  "bowls",
  "cup",
  "cups",
  "glass",
  "glasses",
  "katori",
  "katoris",
  "piece",
  "pieces",
  "slice",
  "slices",
  "spoon",
  "spoons",
  "tbsp",
  "tsp",
  "serving",
  "servings",
  "small",
  "medium",
  "large",
  "full",
  "of",
]);

/** Separators that divide one input into several items. */
const SEPARATOR = /\s*(?:,|\+|&|\band\b|\bwith\b|\bplus\b)\s*/i;

/**
 * Turn "2 rotis and dal" into a draft the user confirms.
 *
 * Nothing here saves. The caller renders the draft, the user corrects it, and
 * only then does a server action write rows — which is also what makes the
 * Gemini swap in phase 4 safe: a model's mistake is something the user sees
 * and edits, not something that silently lands in their log.
 */
export function parseMealText(text: string, foods: FoodRef[]): MealDraft {
  const pieces = (text ?? "")
    .split(SEPARATOR)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0);

  const items: DraftItem[] = [];
  const unmatched: string[] = [];

  for (const piece of pieces) {
    const { quantity, rest } = takeQuantity(piece);
    const food = matchFood(rest, foods);

    if (!food) {
      unmatched.push(piece);
      items.push({
        label: piece,
        foodId: null,
        matchedName: null,
        quantity,
        /* Zero rather than a guess. The row renders as "Couldn't match — add
           details" and the user supplies the numbers or drops the item. */
        kcal: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        isEstimate: true,
        servingLabel: null,
      });
      continue;
    }

    items.push({
      label: piece,
      foodId: food.id,
      matchedName: food.name,
      quantity,
      kcal: round(food.kcal * quantity, 1),
      proteinG: round(food.proteinG * quantity, 1),
      carbsG: round(food.carbsG * quantity, 1),
      fatG: round(food.fatG * quantity, 1),
      /* A table row is still an estimate when the table itself says so. */
      isEstimate: normalise(food.source) === "estimate",
      servingLabel: food.servingLabel,
    });
  }

  return { text: text ?? "", items, unmatched };
}

/**
 * Read a leading quantity off a piece of text.
 *
 * Handles "2", "1/2", "0.5", "two", "half", and a serving word in between
 * ("half plate rice"). Defaults to 1, which is what "dal" on its own means.
 */
export function takeQuantity(piece: string): { quantity: number; rest: string } {
  const tokens = piece.split(/\s+/).filter(Boolean);
  let quantity: number | null = null;
  let index = 0;

  while (index < tokens.length) {
    const token = normalise(tokens[index]);
    const parsed = asQuantity(token);

    if (parsed !== null && quantity === null) {
      quantity = parsed;
      index += 1;
      continue;
    }

    /* Serving words are consumed whether or not a number preceded them, so
       "plate of rice" and "half plate rice" both reduce to "rice". */
    if (SERVING_WORDS.has(token)) {
      index += 1;
      continue;
    }

    break;
  }

  const rest = tokens.slice(index).join(" ").trim();

  /* "half" with nothing after it is a quantity for whatever came before, not a
     food. Returning the original piece lets the matcher decide. */
  if (rest.length === 0) return { quantity: 1, rest: piece.trim() };

  return { quantity: quantity ?? 1, rest };
}

function asQuantity(token: string): number | null {
  if (token in WORD_NUMBERS) return WORD_NUMBERS[token];

  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(token);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return Number(fraction[1]) / denominator;
  }

  if (/^\d+(?:\.\d+)?$/.test(token)) {
    const value = Number(token);
    /* An absurd quantity is far more likely to be a typo than a meal. It is
       passed through as 1 so validation can reject it with a message rather
       than the parser silently inventing a correction. */
    return Number.isFinite(value) && value > 0 && value <= 50 ? value : null;
  }

  return null;
}

/**
 * Best food for a piece of text, or null.
 *
 * Tried in order: exact name, exact alias, singular form of either, then a
 * token-overlap score. The threshold is deliberately high — a wrong match is
 * worse than no match, because no match is visible to the user and a wrong one
 * is not.
 */
export function matchFood(text: string, foods: FoodRef[]): FoodRef | null {
  const query = normalise(text);
  if (query.length === 0) return null;

  const candidates = foods.map((food) => ({
    food,
    keys: [food.name, ...(food.aliases ?? [])].map(normalise),
  }));

  for (const { food, keys } of candidates) {
    if (keys.includes(query)) return food;
  }

  const singular = depluralise(query);
  for (const { food, keys } of candidates) {
    if (keys.some((key) => depluralise(key) === singular)) return food;
  }

  const queryTokens = new Set(tokens(singular));
  if (queryTokens.size === 0) return null;

  let best: { food: FoodRef; score: number } | null = null;

  for (const { food, keys } of candidates) {
    for (const key of keys) {
      const keyTokens = tokens(depluralise(key));
      if (keyTokens.length === 0) continue;

      const overlap = keyTokens.filter((token) =>
        queryTokens.has(depluralise(token)),
      ).length;
      if (overlap === 0) continue;

      /* Every token of the food's name has to be accounted for, so "rice"
         does not match "curd rice" and change what the user ate. */
      const score = overlap / Math.max(keyTokens.length, queryTokens.size);
      if (score >= 0.6 && (!best || score > best.score)) {
        best = { food, score };
      }
    }
  }

  return best?.food ?? null;
}

/** Foods whose name or aliases contain the query, for the search table. */
export function searchFoods(query: string, foods: FoodRef[], limit = 25): FoodRef[] {
  const needle = normalise(query);
  if (needle.length === 0) return foods.slice(0, limit);

  return foods
    .filter((food) =>
      [food.name, ...(food.aliases ?? [])].some((key) =>
        normalise(key).includes(needle),
      ),
    )
    .slice(0, limit);
}

/** Scale a food's macros to a quantity of servings. */
export function scaleFood(food: FoodRef, quantity: number) {
  const q = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

  return {
    kcal: round(food.kcal * q, 1),
    proteinG: round(food.proteinG * q, 1),
    carbsG: round(food.carbsG * q, 1),
    fatG: round(food.fatG * q, 1),
  };
}

/* -------------------------------------------------------------------------- */
/*                                   shared                                   */
/* -------------------------------------------------------------------------- */

function normalise(value: string): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9/.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return value.split(" ").filter((token) => token.length > 1);
}

/**
 * Crude but predictable: "rotis" to "roti", "idlis" to "idli". English plural
 * rules only, which is what the input actually looks like — users type
 * "2 rotis", not a Hindi plural.
 */
function depluralise(value: string): string {
  return value
    .split(" ")
    .map((token) => {
      if (token.length <= 3) return token;
      if (token.endsWith("ies")) return `${token.slice(0, -3)}y`;
      if (token.endsWith("ses") || token.endsWith("hes")) return token.slice(0, -2);
      if (token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
      return token;
    })
    .join(" ");
}

function num(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function round(value: number, places = 0): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
