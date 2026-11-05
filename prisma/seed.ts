/**
 * Seeds the global `Food` reference table.
 *
 * Only reference data is seeded. Demo mode reads fixtures, never the database,
 * so there is no sample account to create here — and seeding one would mean a
 * fresh install had rows nobody signed up for.
 *
 * ---------------------------------------------------------------------------
 * ON THE `source` FIELD — please read before changing these numbers.
 *
 * Every row below is marked `source: "estimate"`, and that is deliberate.
 * The product's rule is that a number is either traceable to a cited source or
 * visibly labelled an estimate; it is never presented as authoritative when it
 * is not. These per-serving macros are reasonable working figures for common
 * Indian preparations, but they were not read off a published table row by
 * row, so claiming "IFCT 2017" against them would be precisely the dishonesty
 * the rule exists to prevent. The UI reads `source` and marks every one of
 * these as an estimate.
 *
 * To upgrade a row properly: look it up in the Indian Food Composition Tables
 * 2017 (National Institute of Nutrition, Hyderabad), replace the four macros
 * with the tabulated values for `servingGrams`, and set
 * `source: "IFCT 2017"`. Rows can be upgraded one at a time — nothing else
 * needs to change, and the UI stops marking that row as an estimate.
 * ---------------------------------------------------------------------------
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

type Seed = {
  name: string;
  aliases?: string[];
  servingLabel: string;
  servingGrams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG?: number;
};

/**
 * Serving sizes are the unit a student actually thinks in — one roti, one
 * katori, one glass — rather than 100 g, because "2 rotis and dal" has to
 * parse into servings without the user converting anything.
 */
const FOODS: Seed[] = [
  /* ------------------------------- breads -------------------------------- */
  { name: "Roti", aliases: ["phulka", "chapati", "chapathi"], servingLabel: "1 roti", servingGrams: 40, kcal: 104, proteinG: 3.1, carbsG: 20.4, fatG: 1.2, fibreG: 2.4 },
  { name: "Paratha", aliases: ["plain paratha"], servingLabel: "1 paratha", servingGrams: 60, kcal: 210, proteinG: 4.5, carbsG: 27, fatG: 9, fibreG: 2.6 },
  { name: "Aloo paratha", aliases: ["potato paratha"], servingLabel: "1 paratha", servingGrams: 100, kcal: 290, proteinG: 6, carbsG: 40, fatG: 11, fibreG: 3.4 },
  { name: "Naan", servingLabel: "1 naan", servingGrams: 90, kcal: 260, proteinG: 8, carbsG: 45, fatG: 5, fibreG: 2 },
  { name: "Bhatura", aliases: ["bhature"], servingLabel: "1 bhatura", servingGrams: 70, kcal: 250, proteinG: 5, carbsG: 30, fatG: 12, fibreG: 1.4 },
  { name: "Puri", aliases: ["poori"], servingLabel: "1 puri", servingGrams: 25, kcal: 100, proteinG: 2, carbsG: 11, fatG: 5, fibreG: 0.8 },
  { name: "Bread slice", aliases: ["white bread", "pav"], servingLabel: "1 slice", servingGrams: 30, kcal: 80, proteinG: 2.6, carbsG: 15, fatG: 0.9, fibreG: 0.8 },
  { name: "Thepla", servingLabel: "1 thepla", servingGrams: 45, kcal: 140, proteinG: 3.4, carbsG: 18, fatG: 6, fibreG: 2.8 },

  /* -------------------------------- rice --------------------------------- */
  { name: "Rice", aliases: ["boiled rice", "chawal", "steamed rice", "white rice"], servingLabel: "1 katori", servingGrams: 150, kcal: 203, proteinG: 4.2, carbsG: 44.5, fatG: 0.4, fibreG: 0.6 },
  { name: "Jeera rice", servingLabel: "1 katori", servingGrams: 150, kcal: 250, proteinG: 4.4, carbsG: 45, fatG: 6, fibreG: 0.8 },
  { name: "Biryani", aliases: ["veg biryani"], servingLabel: "1 plate", servingGrams: 250, kcal: 420, proteinG: 10, carbsG: 62, fatG: 14, fibreG: 3.2 },
  { name: "Chicken biryani", servingLabel: "1 plate", servingGrams: 300, kcal: 560, proteinG: 26, carbsG: 64, fatG: 22, fibreG: 3 },
  { name: "Pulao", aliases: ["veg pulao"], servingLabel: "1 katori", servingGrams: 180, kcal: 290, proteinG: 6, carbsG: 48, fatG: 8, fibreG: 2.6 },
  { name: "Curd rice", aliases: ["thayir sadam"], servingLabel: "1 katori", servingGrams: 200, kcal: 230, proteinG: 7, carbsG: 36, fatG: 6, fibreG: 0.8 },
  { name: "Khichdi", aliases: ["khichri"], servingLabel: "1 katori", servingGrams: 200, kcal: 230, proteinG: 8.5, carbsG: 38, fatG: 4.5, fibreG: 3.6 },
  { name: "Lemon rice", servingLabel: "1 katori", servingGrams: 180, kcal: 280, proteinG: 5, carbsG: 46, fatG: 8, fibreG: 1.4 },

  /* ------------------------------- lentils ------------------------------- */
  { name: "Dal", aliases: ["dal tadka", "toor dal", "arhar dal", "yellow dal"], servingLabel: "1 katori", servingGrams: 150, kcal: 120, proteinG: 6.8, carbsG: 18.2, fatG: 2.4, fibreG: 4.2 },
  { name: "Dal makhani", servingLabel: "1 katori", servingGrams: 150, kcal: 240, proteinG: 9, carbsG: 22, fatG: 12, fibreG: 6 },
  { name: "Rajma", aliases: ["kidney bean curry"], servingLabel: "1 katori", servingGrams: 150, kcal: 180, proteinG: 9.5, carbsG: 26, fatG: 4, fibreG: 7.4 },
  { name: "Chole", aliases: ["chana masala", "chickpea curry", "chana"], servingLabel: "1 katori", servingGrams: 150, kcal: 200, proteinG: 9, carbsG: 28, fatG: 6, fibreG: 7.8 },
  { name: "Sambar", servingLabel: "1 katori", servingGrams: 150, kcal: 110, proteinG: 5, carbsG: 16, fatG: 3, fibreG: 3.4 },
  { name: "Rasam", servingLabel: "1 katori", servingGrams: 150, kcal: 60, proteinG: 2.4, carbsG: 9, fatG: 1.6, fibreG: 1.6 },
  { name: "Sprouts", aliases: ["moong sprouts", "sprouted moong"], servingLabel: "1 katori", servingGrams: 100, kcal: 100, proteinG: 7.5, carbsG: 15, fatG: 0.6, fibreG: 4.6 },

  /* ------------------------------ vegetables ----------------------------- */
  { name: "Paneer sabzi", aliases: ["paneer curry", "paneer masala"], servingLabel: "1 katori", servingGrams: 150, kcal: 280, proteinG: 13, carbsG: 11, fatG: 21, fibreG: 2.2 },
  { name: "Palak paneer", servingLabel: "1 katori", servingGrams: 150, kcal: 250, proteinG: 12, carbsG: 10, fatG: 18, fibreG: 3.4 },
  { name: "Mixed vegetable sabzi", aliases: ["mix veg", "sabzi"], servingLabel: "1 katori", servingGrams: 150, kcal: 130, proteinG: 3.4, carbsG: 14, fatG: 7, fibreG: 4.2 },
  { name: "Aloo sabzi", aliases: ["potato sabzi", "aloo"], servingLabel: "1 katori", servingGrams: 150, kcal: 170, proteinG: 3, carbsG: 25, fatG: 6.5, fibreG: 3 },
  { name: "Bhindi", aliases: ["okra", "ladies finger"], servingLabel: "1 katori", servingGrams: 150, kcal: 140, proteinG: 3, carbsG: 12, fatG: 9, fibreG: 4.4 },
  { name: "Baingan bharta", aliases: ["brinjal"], servingLabel: "1 katori", servingGrams: 150, kcal: 150, proteinG: 3, carbsG: 13, fatG: 9.5, fibreG: 4.6 },
  { name: "Cabbage sabzi", servingLabel: "1 katori", servingGrams: 150, kcal: 100, proteinG: 2.6, carbsG: 10, fatG: 5.5, fibreG: 3.6 },
  { name: "Salad", aliases: ["green salad", "kachumber"], servingLabel: "1 bowl", servingGrams: 100, kcal: 35, proteinG: 1.4, carbsG: 6, fatG: 0.3, fibreG: 2 },

  /* ------------------------- south Indian tiffin ------------------------- */
  { name: "Idli", servingLabel: "1 idli", servingGrams: 50, kcal: 70, proteinG: 2.2, carbsG: 14.5, fatG: 0.3, fibreG: 0.8 },
  { name: "Dosa", aliases: ["plain dosa", "sada dosa"], servingLabel: "1 dosa", servingGrams: 80, kcal: 165, proteinG: 4, carbsG: 26, fatG: 5, fibreG: 1.4 },
  { name: "Masala dosa", servingLabel: "1 dosa", servingGrams: 150, kcal: 290, proteinG: 6, carbsG: 42, fatG: 11, fibreG: 3 },
  { name: "Uttapam", aliases: ["uthappam"], servingLabel: "1 uttapam", servingGrams: 120, kcal: 200, proteinG: 5.4, carbsG: 32, fatG: 5.5, fibreG: 2.2 },
  { name: "Vada", aliases: ["medu vada"], servingLabel: "1 vada", servingGrams: 45, kcal: 140, proteinG: 4, carbsG: 14, fatG: 7.5, fibreG: 2 },
  { name: "Upma", servingLabel: "1 katori", servingGrams: 150, kcal: 220, proteinG: 5, carbsG: 32, fatG: 8, fibreG: 2.4 },
  { name: "Poha", aliases: ["kanda poha"], servingLabel: "1 katori", servingGrams: 150, kcal: 210, proteinG: 4.4, carbsG: 36, fatG: 6, fibreG: 2 },
  { name: "Coconut chutney", servingLabel: "2 tbsp", servingGrams: 30, kcal: 70, proteinG: 1.2, carbsG: 3.4, fatG: 6, fibreG: 1.6 },

  /* ------------------------------ non-veg -------------------------------- */
  { name: "Egg", aliases: ["boiled egg", "anda"], servingLabel: "1 egg", servingGrams: 50, kcal: 78, proteinG: 6.3, carbsG: 0.6, fatG: 5.3, fibreG: 0 },
  { name: "Egg bhurji", aliases: ["scrambled egg"], servingLabel: "2 eggs", servingGrams: 120, kcal: 220, proteinG: 13, carbsG: 3.4, fatG: 17, fibreG: 0.6 },
  { name: "Omelette", servingLabel: "2 eggs", servingGrams: 120, kcal: 230, proteinG: 13, carbsG: 2.4, fatG: 18, fibreG: 0.4 },
  { name: "Chicken curry", servingLabel: "1 katori", servingGrams: 150, kcal: 250, proteinG: 22, carbsG: 6, fatG: 15, fibreG: 1.2 },
  { name: "Grilled chicken", aliases: ["chicken breast", "tandoori chicken"], servingLabel: "100 g", servingGrams: 100, kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fibreG: 0 },
  { name: "Fish curry", servingLabel: "1 katori", servingGrams: 150, kcal: 200, proteinG: 20, carbsG: 5, fatG: 11, fibreG: 1 },
  { name: "Mutton curry", servingLabel: "1 katori", servingGrams: 150, kcal: 300, proteinG: 21, carbsG: 5, fatG: 22, fibreG: 1 },
  { name: "Chicken roll", aliases: ["egg roll", "kathi roll"], servingLabel: "1 roll", servingGrams: 200, kcal: 420, proteinG: 18, carbsG: 44, fatG: 19, fibreG: 3 },

  /* ------------------------------- dairy --------------------------------- */
  { name: "Milk", aliases: ["doodh", "toned milk"], servingLabel: "1 glass", servingGrams: 200, kcal: 120, proteinG: 6.4, carbsG: 9.6, fatG: 6.4, fibreG: 0 },
  { name: "Curd", aliases: ["dahi", "yoghurt", "yogurt"], servingLabel: "1 katori", servingGrams: 150, kcal: 90, proteinG: 5.2, carbsG: 7, fatG: 4.6, fibreG: 0 },
  { name: "Paneer", aliases: ["cottage cheese"], servingLabel: "50 g", servingGrams: 50, kcal: 130, proteinG: 9, carbsG: 2, fatG: 9.5, fibreG: 0 },
  { name: "Buttermilk", aliases: ["chaas", "chhach"], servingLabel: "1 glass", servingGrams: 200, kcal: 40, proteinG: 2.4, carbsG: 4.4, fatG: 1.4, fibreG: 0 },
  { name: "Lassi", aliases: ["sweet lassi"], servingLabel: "1 glass", servingGrams: 250, kcal: 220, proteinG: 7, carbsG: 32, fatG: 7, fibreG: 0 },
  { name: "Ghee", servingLabel: "1 tsp", servingGrams: 5, kcal: 45, proteinG: 0, carbsG: 0, fatG: 5, fibreG: 0 },
  { name: "Butter", servingLabel: "1 tsp", servingGrams: 5, kcal: 36, proteinG: 0, carbsG: 0, fatG: 4, fibreG: 0 },
  { name: "Cheese slice", servingLabel: "1 slice", servingGrams: 20, kcal: 70, proteinG: 4, carbsG: 0.6, fatG: 5.8, fibreG: 0 },

  /* ------------------------------- drinks -------------------------------- */
  { name: "Chai", aliases: ["tea", "masala chai"], servingLabel: "1 cup", servingGrams: 150, kcal: 90, proteinG: 2.4, carbsG: 11, fatG: 3.8, fibreG: 0 },
  { name: "Coffee with milk", aliases: ["coffee", "filter coffee"], servingLabel: "1 cup", servingGrams: 150, kcal: 80, proteinG: 2.6, carbsG: 9, fatG: 3.4, fibreG: 0 },
  { name: "Black coffee", servingLabel: "1 cup", servingGrams: 150, kcal: 5, proteinG: 0.3, carbsG: 0.8, fatG: 0, fibreG: 0 },
  { name: "Green tea", servingLabel: "1 cup", servingGrams: 150, kcal: 2, proteinG: 0, carbsG: 0.4, fatG: 0, fibreG: 0 },
  { name: "Cold drink", aliases: ["soft drink", "cola", "soda"], servingLabel: "1 can", servingGrams: 300, kcal: 130, proteinG: 0, carbsG: 33, fatG: 0, fibreG: 0 },
  { name: "Fruit juice", aliases: ["orange juice", "packaged juice"], servingLabel: "1 glass", servingGrams: 200, kcal: 110, proteinG: 0.8, carbsG: 26, fatG: 0.2, fibreG: 0.4 },
  { name: "Protein shake", aliases: ["whey protein"], servingLabel: "1 scoop", servingGrams: 30, kcal: 120, proteinG: 24, carbsG: 2.4, fatG: 1.4, fibreG: 0.6 },

  /* -------------------------------- fruit -------------------------------- */
  { name: "Banana", aliases: ["kela"], servingLabel: "1 medium", servingGrams: 120, kcal: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, fibreG: 3.1 },
  { name: "Apple", aliases: ["seb"], servingLabel: "1 medium", servingGrams: 180, kcal: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3, fibreG: 4.4 },
  { name: "Orange", aliases: ["santra"], servingLabel: "1 medium", servingGrams: 150, kcal: 62, proteinG: 1.2, carbsG: 15, fatG: 0.2, fibreG: 3.1 },
  { name: "Mango", aliases: ["aam"], servingLabel: "1 medium", servingGrams: 200, kcal: 135, proteinG: 1.8, carbsG: 34, fatG: 0.6, fibreG: 3.6 },
  { name: "Papaya", servingLabel: "1 bowl", servingGrams: 150, kcal: 65, proteinG: 0.7, carbsG: 16, fatG: 0.4, fibreG: 2.5 },
  { name: "Grapes", aliases: ["angoor"], servingLabel: "1 bowl", servingGrams: 100, kcal: 69, proteinG: 0.7, carbsG: 18, fatG: 0.2, fibreG: 0.9 },
  { name: "Watermelon", aliases: ["tarbooz"], servingLabel: "1 bowl", servingGrams: 150, kcal: 45, proteinG: 0.9, carbsG: 11, fatG: 0.2, fibreG: 0.6 },
  { name: "Pomegranate", aliases: ["anar"], servingLabel: "1 bowl", servingGrams: 100, kcal: 83, proteinG: 1.7, carbsG: 19, fatG: 1.2, fibreG: 4 },

  /* ------------------------------- snacks -------------------------------- */
  { name: "Samosa", servingLabel: "1 samosa", servingGrams: 60, kcal: 180, proteinG: 3.4, carbsG: 20, fatG: 9.5, fibreG: 1.8 },
  { name: "Pakora", aliases: ["bhaji", "bhajiya"], servingLabel: "4 pieces", servingGrams: 60, kcal: 190, proteinG: 4.4, carbsG: 17, fatG: 11, fibreG: 2.4 },
  { name: "Vada pav", servingLabel: "1 vada pav", servingGrams: 150, kcal: 300, proteinG: 7, carbsG: 42, fatG: 12, fibreG: 3.2 },
  { name: "Pav bhaji", servingLabel: "1 plate", servingGrams: 300, kcal: 450, proteinG: 10, carbsG: 56, fatG: 20, fibreG: 6 },
  { name: "Dhokla", servingLabel: "3 pieces", servingGrams: 100, kcal: 150, proteinG: 5.4, carbsG: 22, fatG: 4.4, fibreG: 2.2 },
  { name: "Biscuit", aliases: ["biscuits", "parle g", "marie biscuit"], servingLabel: "2 biscuits", servingGrams: 20, kcal: 90, proteinG: 1.4, carbsG: 15, fatG: 2.8, fibreG: 0.4 },
  { name: "Peanuts", aliases: ["moongphali", "groundnut"], servingLabel: "handful", servingGrams: 30, kcal: 170, proteinG: 7.6, carbsG: 5, fatG: 14, fibreG: 2.6 },
  { name: "Peanut chikki", aliases: ["chikki", "peanut brittle"], servingLabel: "1 piece", servingGrams: 25, kcal: 120, proteinG: 3.4, carbsG: 14, fatG: 6, fibreG: 1.2 },
  { name: "Almonds", aliases: ["badam"], servingLabel: "10 almonds", servingGrams: 12, kcal: 70, proteinG: 2.6, carbsG: 2.4, fatG: 6, fibreG: 1.5 },
  { name: "Chips", aliases: ["potato chips", "wafers"], servingLabel: "1 small packet", servingGrams: 30, kcal: 160, proteinG: 1.8, carbsG: 15, fatG: 10, fibreG: 1.2 },
  { name: "Bhel puri", servingLabel: "1 plate", servingGrams: 150, kcal: 250, proteinG: 6, carbsG: 38, fatG: 8, fibreG: 4 },
  { name: "Maggi", aliases: ["instant noodles", "noodles"], servingLabel: "1 packet", servingGrams: 70, kcal: 310, proteinG: 6.6, carbsG: 42, fatG: 12, fibreG: 2 },

  /* ------------------------------- sweets -------------------------------- */
  { name: "Gulab jamun", servingLabel: "1 piece", servingGrams: 40, kcal: 150, proteinG: 2, carbsG: 22, fatG: 6, fibreG: 0.2 },
  { name: "Jalebi", servingLabel: "2 pieces", servingGrams: 50, kcal: 190, proteinG: 1.4, carbsG: 32, fatG: 7, fibreG: 0.2 },
  { name: "Ladoo", aliases: ["laddu", "besan ladoo"], servingLabel: "1 ladoo", servingGrams: 40, kcal: 180, proteinG: 3.4, carbsG: 22, fatG: 9, fibreG: 1.2 },
  { name: "Kheer", aliases: ["rice pudding"], servingLabel: "1 katori", servingGrams: 150, kcal: 220, proteinG: 5.4, carbsG: 34, fatG: 7, fibreG: 0.4 },
  { name: "Ice cream", servingLabel: "1 scoop", servingGrams: 60, kcal: 130, proteinG: 2.4, carbsG: 16, fatG: 6.5, fibreG: 0.2 },
  { name: "Chocolate", aliases: ["dairy milk"], servingLabel: "1 small bar", servingGrams: 25, kcal: 130, proteinG: 1.8, carbsG: 15, fatG: 7, fibreG: 0.6 },
  { name: "Sugar", aliases: ["cheeni"], servingLabel: "1 tsp", servingGrams: 5, kcal: 20, proteinG: 0, carbsG: 5, fatG: 0, fibreG: 0 },

  /* -------------------------------- other -------------------------------- */
  { name: "Oats", aliases: ["oatmeal", "porridge"], servingLabel: "1 katori", servingGrams: 40, kcal: 150, proteinG: 5.4, carbsG: 27, fatG: 2.8, fibreG: 4 },
  { name: "Cornflakes", servingLabel: "1 katori", servingGrams: 30, kcal: 110, proteinG: 2, carbsG: 25, fatG: 0.4, fibreG: 0.8 },
  { name: "Besan chilla", aliases: ["chilla", "cheela"], servingLabel: "1 chilla", servingGrams: 80, kcal: 170, proteinG: 7.4, carbsG: 18, fatG: 7.5, fibreG: 3.4 },
  { name: "Idli sambar", servingLabel: "2 idli with sambar", servingGrams: 250, kcal: 250, proteinG: 9.4, carbsG: 45, fatG: 3.6, fibreG: 4.2 },
  { name: "Rajma chawal", servingLabel: "1 plate", servingGrams: 350, kcal: 420, proteinG: 14, carbsG: 70, fatG: 8, fibreG: 9 },
  { name: "Chole bhature", servingLabel: "1 plate", servingGrams: 350, kcal: 650, proteinG: 16, carbsG: 78, fatG: 28, fibreG: 10 },
  { name: "Cooking oil", aliases: ["oil", "refined oil"], servingLabel: "1 tsp", servingGrams: 5, kcal: 45, proteinG: 0, carbsG: 0, fatG: 5, fibreG: 0 },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  console.info(`Seeding ${FOODS.length} foods…`);

  let created = 0;
  let updated = 0;

  for (const food of FOODS) {
    /* Upsert on the unique name, so running the seed twice corrects the rows
       rather than failing or duplicating them. A row whose `source` has been
       upgraded to a cited table by hand would be reset by this, which is the
       right trade while every row is still an estimate. */
    const existing = await prisma.food.findUnique({ where: { name: food.name } });

    const data = {
      name: food.name,
      aliases: food.aliases ?? [],
      servingLabel: food.servingLabel,
      servingGrams: food.servingGrams,
      kcal: food.kcal,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      fibreG: food.fibreG ?? 0,
      source: "estimate",
    };

    await prisma.food.upsert({
      where: { name: food.name },
      create: data,
      update: data,
    });

    if (existing) updated += 1;
    else created += 1;
  }

  const total = await prisma.food.count();
  const withoutSource = await prisma.food.count({ where: { source: "" } });

  console.info(`  created ${created}, updated ${updated}`);
  console.info(`  ${total} foods in the table, ${withoutSource} without a source`);

  if (withoutSource > 0) {
    throw new Error("Every food row must carry a source. Some do not.");
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
