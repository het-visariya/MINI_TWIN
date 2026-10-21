/**
 * Demo fixtures for the Health, Nutrition, Finance, Career, Insights,
 * Reminders and Privacy modules.
 *
 * Split out of fixtures.ts, which was already past the length where one file
 * stays readable. Same rules apply: every figure is sample data for one
 * fictional user — a 21-year-old engineering student in Pune — and no screen
 * imports this file. The module repos do.
 *
 * Nothing here is a real-world reference value. The food macros a demo meal
 * shows come from the same seeded table a real account reads, and that table
 * carries its own `source` per row.
 */

import {
  bmi,
  bmiCategory,
  calorieEstimate,
  isoDate,
  perMealSplit,
  personalRecords,
  proteinRange,
  startOfWeek,
  volumeSeries,
  waterTarget,
  weeklyConsistency,
  type SetRow,
} from "@/lib/domain/calc/health";
import {
  dailyTotals,
  macroTargets,
  type FoodRef,
} from "@/lib/domain/calc/nutrition";
import type { HealthView } from "@/lib/data/health.repo";
import type {
  MealItemView,
  MealLogView,
  NutritionView,
} from "@/lib/data/nutrition.repo";
import {
  annualSubscriptionCost,
  dailyCumulative,
  fdMaturity,
  investmentSummary,
  monthlyToReachGoal,
  projectedMonthEnd,
  savingsProgress,
  spendByCategory,
} from "@/lib/domain/calc/finance";
import type { ExpenseView, FinanceView } from "@/lib/data/finance.repo";
import {
  daysToTarget,
  placementProgress,
  roadmapProgress,
  skillGap,
} from "@/lib/domain/calc/career";
import { findRoleTemplate } from "@/lib/domain/data/role-templates";
import type { CareerView } from "@/lib/data/career.repo";

/** Days back from `now`, as a yyyy-mm-dd string. */
function daysAgo(now: Date, days: number): string {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return isoDate(date);
}

/* -------------------------------------------------------------------------- */
/*                                   health                                   */
/* -------------------------------------------------------------------------- */

const DEMO_HEIGHT_CM = 172;
const DEMO_WEIGHT_KG = 68.4;
/** 21 years old, so the adult BMI path is the one the demo exercises. */
const DEMO_DOB = "2005-03-14";

/**
 * Four weeks of training, three sessions a week, with the weight on the
 * compound lifts creeping up — so the demo shows a personal record and a
 * rising volume chart rather than a flat line.
 */
function demoSets(now: Date): { date: string; sets: Omit<SetRow, "date">[] }[] {
  const plan: { offset: number; lifts: [string, number, number][] }[] = [
    { offset: 1, lifts: [["Squat", 5, 70], ["Bench press", 8, 45], ["Barbell row", 8, 40]] },
    { offset: 3, lifts: [["Deadlift", 5, 90], ["Overhead press", 8, 30], ["Pull-up", 6, 0]] },
    { offset: 6, lifts: [["Squat", 5, 67.5], ["Bench press", 8, 42.5], ["Barbell row", 10, 37.5]] },
    { offset: 8, lifts: [["Deadlift", 5, 87.5], ["Overhead press", 8, 30], ["Pull-up", 5, 0]] },
    { offset: 10, lifts: [["Squat", 6, 65], ["Bench press", 10, 40], ["Barbell row", 10, 35]] },
    { offset: 13, lifts: [["Deadlift", 6, 85], ["Overhead press", 10, 27.5], ["Pull-up", 5, 0]] },
    { offset: 15, lifts: [["Squat", 8, 62.5], ["Bench press", 10, 40], ["Barbell row", 10, 35]] },
    { offset: 17, lifts: [["Deadlift", 8, 80], ["Overhead press", 10, 27.5]] },
    { offset: 20, lifts: [["Squat", 8, 60], ["Bench press", 10, 37.5]] },
    { offset: 22, lifts: [["Deadlift", 8, 80], ["Barbell row", 10, 32.5]] },
    { offset: 24, lifts: [["Squat", 10, 57.5], ["Overhead press", 10, 25]] },
  ];

  return plan.map((entry) => ({
    date: daysAgo(now, entry.offset),
    sets: entry.lifts.flatMap(([exercise, reps, weightKg]) =>
      /* Three working sets of each lift, which is what the logger records. */
      [0, 1, 2].map(() => ({ exercise, reps, weightKg })),
    ),
  }));
}

export function healthView(now: Date): HealthView {
  const sessions = demoSets(now);

  const sessionViews = sessions.map((session, index) => ({
    id: `demo-session-${index}`,
    date: session.date,
    notes: index === 0 ? "Felt strong. Squat moved well." : undefined,
    sets: session.sets.map((set, setIndex) => ({
      id: `demo-set-${index}-${setIndex}`,
      exercise: set.exercise,
      setIndex,
      reps: set.reps,
      weightKg: set.weightKg,
    })),
    volumeKg: session.sets.reduce((total, set) => total + set.reps * set.weightKg, 0),
  }));

  const setRows: SetRow[] = sessions.flatMap((session) =>
    session.sets.map((set) => ({ ...set, date: session.date })),
  );

  /* A slow, unremarkable drift. The product compares the user with their own
     past, so a demo weight series that plunges would be teaching the wrong
     thing about what this screen is for. */
  const weights = [28, 24, 21, 17, 14, 10, 7, 3, 0].map((offset, index) => ({
    date: daysAgo(now, offset),
    weightKg: Number((69.4 - index * 0.125).toFixed(1)),
  }));

  const sleep = Array.from({ length: 21 }, (_, index) => {
    const offset = 20 - index;
    /* Short on weeknights, caught up at the weekend — the pattern the Life
       Graph is there to let a student notice for themselves. */
    const weekday = new Date(now.getTime() - offset * 86_400_000).getDay();
    const base = weekday === 0 || weekday === 6 ? 500 : 395;
    return {
      date: daysAgo(now, offset),
      minutes: base + ((index * 17) % 40),
      quality: ((index % 3) + 3) as number,
    };
  });

  const water = [
    { date: isoDate(now), ml: 250 },
    { date: isoDate(now), ml: 500 },
    { date: isoDate(now), ml: 250 },
    { date: daysAgo(now, 1), ml: 1750 },
    { date: daysAgo(now, 2), ml: 2000 },
  ];

  const latestWeightKg = weights[weights.length - 1].weightKg;
  const bmiValue = bmi(DEMO_HEIGHT_CM, latestWeightKg);
  const range = proteinRange(latestWeightKg, "MODERATE");

  const ageYears = 21;
  const ageMonths = Math.floor(
    (now.getTime() - new Date(DEMO_DOB).getTime()) / (86_400_000 * 30.4375),
  );

  return {
    profile: {
      heightCm: DEMO_HEIGHT_CM,
      activityLevel: "MODERATE",
      plannedPerWeek: 3,
      sex: "MALE",
      ageYears,
      ageMonths,
      hasMedicalCondition: false,
      mayShowWeightGoal: true,
    },

    sessions: sessionViews,
    exerciseHistory: [
      "Barbell row",
      "Bench press",
      "Deadlift",
      "Overhead press",
      "Pull-up",
      "Squat",
    ],
    personalRecords: personalRecords(setRows),
    volume: volumeSeries(setRows, now, 8),
    consistency: weeklyConsistency(
      sessionViews.map((session) => ({ date: session.date })),
      3,
      startOfWeek(now),
    ),

    weights,
    latestWeightKg,
    bmi: bmiValue,
    bmiVerdict: bmiCategory(bmiValue, { ageMonths, sex: "MALE" }),

    sleep,

    water: {
      todayMl: 1000,
      target: waterTarget(latestWeightKg),
      recent: water,
    },

    mood: { date: isoDate(now), mood: 4, energy: 3 },

    protein: { range, perMeal: perMealSplit(range, 3) },
    calories: calorieEstimate({
      weightKg: latestWeightKg,
      heightCm: DEMO_HEIGHT_CM,
      ageYears,
      sex: "MALE",
      activityLevel: "MODERATE",
    }),
  };
}

export { DEMO_DOB, DEMO_HEIGHT_CM, DEMO_WEIGHT_KG };

/* -------------------------------------------------------------------------- */
/*                                  nutrition                                 */
/* -------------------------------------------------------------------------- */

/**
 * A small slice of the food table for demo mode.
 *
 * Demo mode never reads the database, so the parser needs something to match
 * against. These carry the same `source: "estimate"` the seeded rows do, which
 * is what makes the "estimates are marked" treatment visible in the demo.
 */
const DEMO_FOODS: FoodRef[] = [
  { id: "f-roti", name: "Roti", aliases: ["phulka", "chapati"], servingLabel: "1 roti", servingGrams: 40, kcal: 104, proteinG: 3.1, carbsG: 20.4, fatG: 1.2, fibreG: 2.4, source: "estimate" },
  { id: "f-dal", name: "Dal", aliases: ["dal tadka", "toor dal"], servingLabel: "1 katori", servingGrams: 150, kcal: 120, proteinG: 6.8, carbsG: 18.2, fatG: 2.4, fibreG: 4.2, source: "estimate" },
  { id: "f-rice", name: "Rice", aliases: ["chawal", "boiled rice"], servingLabel: "1 katori", servingGrams: 150, kcal: 203, proteinG: 4.2, carbsG: 44.5, fatG: 0.4, fibreG: 0.6, source: "estimate" },
  { id: "f-curd", name: "Curd", aliases: ["dahi", "yoghurt"], servingLabel: "1 katori", servingGrams: 150, kcal: 90, proteinG: 5.2, carbsG: 7, fatG: 4.6, fibreG: 0, source: "estimate" },
  { id: "f-egg", name: "Egg", aliases: ["boiled egg", "anda"], servingLabel: "1 egg", servingGrams: 50, kcal: 78, proteinG: 6.3, carbsG: 0.6, fatG: 5.3, fibreG: 0, source: "estimate" },
  { id: "f-poha", name: "Poha", aliases: ["kanda poha"], servingLabel: "1 katori", servingGrams: 150, kcal: 210, proteinG: 4.4, carbsG: 36, fatG: 6, fibreG: 2, source: "estimate" },
  { id: "f-chai", name: "Chai", aliases: ["tea", "masala chai"], servingLabel: "1 cup", servingGrams: 150, kcal: 90, proteinG: 2.4, carbsG: 11, fatG: 3.8, fibreG: 0, source: "estimate" },
  { id: "f-banana", name: "Banana", aliases: ["kela"], servingLabel: "1 medium", servingGrams: 120, kcal: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, fibreG: 3.1, source: "estimate" },
  { id: "f-paneer", name: "Paneer sabzi", aliases: ["paneer curry"], servingLabel: "1 katori", servingGrams: 150, kcal: 280, proteinG: 13, carbsG: 11, fatG: 21, fibreG: 2.2, source: "estimate" },
  { id: "f-chicken", name: "Grilled chicken", aliases: ["chicken breast"], servingLabel: "100 g", servingGrams: 100, kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fibreG: 0, source: "estimate" },
  { id: "f-samosa", name: "Samosa", aliases: [], servingLabel: "1 samosa", servingGrams: 60, kcal: 180, proteinG: 3.4, carbsG: 20, fatG: 9.5, fibreG: 1.8, source: "estimate" },
  { id: "f-milk", name: "Milk", aliases: ["doodh"], servingLabel: "1 glass", servingGrams: 200, kcal: 120, proteinG: 6.4, carbsG: 9.6, fatG: 6.4, fibreG: 0, source: "estimate" },
];

function item(
  id: string,
  food: FoodRef,
  quantity: number,
): MealItemView {
  return {
    id,
    label: `${quantity} ${food.name.toLowerCase()}`,
    matchedName: food.name,
    quantity,
    kcal: Math.round(food.kcal * quantity * 10) / 10,
    proteinG: Math.round(food.proteinG * quantity * 10) / 10,
    carbsG: Math.round(food.carbsG * quantity * 10) / 10,
    fatG: Math.round(food.fatG * quantity * 10) / 10,
    isEstimate: true,
    servingLabel: food.servingLabel,
  };
}

const food = (id: string) => DEMO_FOODS.find((row) => row.id === id)!;

export function nutritionView(now: Date): NutritionView {
  const date = isoDate(now);

  const breakfast: MealItemView[] = [
    item("d-i-1", food("f-poha"), 1),
    item("d-i-2", food("f-chai"), 1),
  ];

  const lunch: MealItemView[] = [
    item("d-i-3", food("f-roti"), 3),
    item("d-i-4", food("f-dal"), 1),
    item("d-i-5", food("f-curd"), 1),
  ];

  const snack: MealItemView[] = [
    item("d-i-6", food("f-banana"), 1),
    /* One deliberately unmatched row, so the demo shows what the parser does
       when it cannot identify something rather than hiding it. */
    {
      id: "d-i-7",
      label: "canteen cutlet",
      matchedName: null,
      quantity: 1,
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      isEstimate: true,
      servingLabel: null,
    },
  ];

  const meals: MealLogView[] = [
    { id: "d-m-1", date, mealType: "BREAKFAST", items: breakfast, totals: dailyTotals(breakfast) },
    { id: "d-m-2", date, mealType: "LUNCH", items: lunch, totals: dailyTotals(lunch) },
    { id: "d-m-3", date, mealType: "SNACK", items: snack, totals: dailyTotals(snack) },
  ];

  const range = proteinRange(DEMO_WEIGHT_KG, "MODERATE");
  const energy = calorieEstimate({
    weightKg: DEMO_WEIGHT_KG,
    heightCm: DEMO_HEIGHT_CM,
    ageYears: 21,
    sex: "MALE",
    activityLevel: "MODERATE",
  });

  const savedLunch = [
    item("d-s-1", food("f-roti"), 3),
    item("d-s-2", food("f-dal"), 1),
    item("d-s-3", food("f-curd"), 1),
  ];
  const savedBreakfast = [item("d-s-4", food("f-egg"), 2), item("d-s-5", food("f-milk"), 1)];

  return {
    profile: {
      dietType: "EGGETARIAN",
      /* A declared allergen, so the demo can show the blocking warning. */
      allergies: ["peanut"],
    },
    foods: DEMO_FOODS,
    today: meals,
    totals: dailyTotals(meals.flatMap((meal) => meal.items)),
    targets: macroTargets({
      kcal: energy?.kcal ?? null,
      proteinMinG: range?.min ?? null,
      proteinMaxG: range?.max ?? null,
    }),
    savedMeals: [
      { id: "d-sm-1", name: "Usual lunch", items: savedLunch.map((row) => ({ label: row.label, quantity: row.quantity })), totals: dailyTotals(savedLunch) },
      { id: "d-sm-2", name: "Eggs and milk", items: savedBreakfast.map((row) => ({ label: row.label, quantity: row.quantity })), totals: dailyTotals(savedBreakfast) },
    ],
    daysLoggedLast14: 9,
  };
}

/* -------------------------------------------------------------------------- */
/*                                   finance                                  */
/* -------------------------------------------------------------------------- */

/** ₹8,000 a month to live on, which is what a hostel student actually has. */
const DEMO_BUDGET_MINOR = 800_000;
const DEMO_INCOME_MINOR = 1_000_000;

export function financeView(now: Date): FinanceView {
  const year = now.getFullYear();
  const month = now.getMonth();
  const dayOfMonth = now.getDate();

  const day = (d: number) => isoDate(new Date(year, month, Math.min(d, dayOfMonth)));

  /* Spread across the month so the run-rate projection has something real to
     work from, and weighted towards food and travel the way a student's is. */
  const expenses: ExpenseView[] = [
    { id: "d-e-1", date: day(1), category: "Rent", amountMinor: 350_000, paymentMethod: "UPI", note: "Hostel mess + room" },
    { id: "d-e-2", date: day(2), category: "Food", amountMinor: 18_000, paymentMethod: "UPI", note: "Canteen" },
    { id: "d-e-3", date: day(3), category: "Travel", amountMinor: 4_000, paymentMethod: "CASH" },
    { id: "d-e-4", date: day(4), category: "Books", amountMinor: 62_000, paymentMethod: "CARD", note: "DBMS textbook" },
    { id: "d-e-5", date: day(6), category: "Food", amountMinor: 24_000, paymentMethod: "UPI" },
    { id: "d-e-6", date: day(8), category: "Phone", amountMinor: 29_900, paymentMethod: "UPI", note: "Recharge" },
    { id: "d-e-7", date: day(9), category: "Fun", amountMinor: 35_000, paymentMethod: "UPI", note: "Cinema" },
    { id: "d-e-8", date: day(11), category: "Food", amountMinor: 21_000, paymentMethod: "CASH" },
    { id: "d-e-9", date: day(13), category: "Travel", amountMinor: 12_000, paymentMethod: "UPI", note: "Train home" },
    { id: "d-e-10", date: day(15), category: "Health", amountMinor: 45_000, paymentMethod: "CARD", note: "Gym fee" },
    { id: "d-e-11", date: day(17), category: "Food", amountMinor: 26_500, paymentMethod: "UPI" },
    { id: "d-e-12", date: day(19), category: "Fun", amountMinor: 15_000, paymentMethod: "UPI" },
    { id: "d-e-13", date: day(21), category: "Food", amountMinor: 19_000, paymentMethod: "CASH" },
  ].filter((expense) => new Date(expense.date).getDate() <= dayOfMonth) as ExpenseView[];

  const subscriptionRows = [
    { name: "Music streaming", amountMinor: 11_900, cycle: "MONTHLY" as const, nextRenewal: isoDate(new Date(year, month, Math.min(28, 28))) },
    { name: "Cloud storage", amountMinor: 8_900, cycle: "MONTHLY" as const, nextRenewal: isoDate(new Date(year, month + 1, 3)) },
    { name: "Course platform", amountMinor: 299_000, cycle: "YEARLY" as const, nextRenewal: isoDate(new Date(year, month + 4, 12)) },
  ];

  const investments = [
    { kind: "SIP" as const, name: "Index fund SIP", investedMinor: 1_200_000, currentMinor: 1_318_000, interestRate: null, sipAmountMinor: 100_000, startDate: isoDate(new Date(year - 1, month, 5)) },
    { kind: "FD" as const, name: "Bank FD", investedMinor: 2_500_000, currentMinor: 2_500_000, interestRate: 7.1, sipAmountMinor: null, startDate: isoDate(new Date(year - 1, month, 1)) },
    { kind: "STOCK" as const, name: "One large-cap holding", investedMinor: 600_000, currentMinor: 547_000, interestRate: null, sipAmountMinor: null, startDate: isoDate(new Date(year, month - 6, 14)) },
  ];

  return {
    profile: {
      monthlyIncomeMinor: DEMO_INCOME_MINOR,
      monthlyBudgetMinor: DEMO_BUDGET_MINOR,
      currency: "INR",
    },

    expenses,
    categories: spendByCategory(expenses, now),
    projection: projectedMonthEnd(expenses, DEMO_BUDGET_MINOR, now, subscriptionRows),
    cumulative: dailyCumulative(expenses, now),

    subscriptions: subscriptionRows.map((row, index) => ({
      id: `d-sub-${index}`,
      ...row,
      daysAway: Math.round(
        (new Date(row.nextRenewal).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) /
          86_400_000,
      ),
    })),
    annualSubscriptionMinor: annualSubscriptionCost(subscriptionRows),

    savingsGoals: [
      {
        id: "d-sg-1",
        name: "Laptop upgrade",
        targetMinor: 6_500_000,
        savedMinor: 2_100_000,
        deadline: isoDate(new Date(year + 1, 5, 1)),
        progress: savingsProgress(2_100_000, 6_500_000),
        monthlyNeededMinor: monthlyToReachGoal(
          2_100_000,
          6_500_000,
          new Date(year + 1, 5, 1),
          now,
        ),
      },
      {
        id: "d-sg-2",
        name: "Emergency buffer",
        targetMinor: 2_000_000,
        savedMinor: 2_000_000,
        deadline: null,
        progress: savingsProgress(2_000_000, 2_000_000),
        monthlyNeededMinor: null,
      },
    ],

    investments: investments.map((row, index) => ({
      id: `d-inv-${index}`,
      kind: row.kind,
      name: row.name,
      symbol: null,
      units: 0,
      investedMinor: row.investedMinor,
      currentMinor: row.currentMinor,
      interestRate: row.interestRate,
      sipAmountMinor: row.sipAmountMinor,
      sipDay: row.kind === "SIP" ? 5 : null,
      startDate: row.startDate,
      maturity:
        row.kind === "FD" && row.interestRate
          ? fdMaturity(row.investedMinor, row.interestRate, 1, "quarterly")
          : null,
    })),
    investmentSummary: investmentSummary(investments),

    /* Always false in the demo: there is no market-data key, and showing a
       live price that is not live would misrepresent the product. */
    livePrices: false,
  };
}

/* -------------------------------------------------------------------------- */
/*                                   career                                   */
/* -------------------------------------------------------------------------- */

export function careerView(now: Date): CareerView {
  const template = findRoleTemplate("backend")!;

  const requirements = template.skills.map((skill, index) => ({
    id: `d-req-${index}`,
    skill: skill.skill,
    requiredLevel: skill.requiredLevel,
  }));

  /* Partway there, with real gaps left. A demo showing 95% readiness teaches
     nothing about what the chart is for. */
  const selfRatings: Record<string, number> = {
    "A backend language (Java, Go, Python or Node)": 3,
    "SQL and schema design": 3,
    "REST and API design": 2,
    Git: 4,
    Testing: 1,
    "Linux and the shell": 2,
    "Caching and queues": 1,
    "Data structures and algorithms": 3,
  };

  const skills = Object.entries(selfRatings).map(([skill, level], index) => ({
    id: `d-skill-${index}`,
    skill,
    level,
    evidence:
      skill === "Git"
        ? "Used it on every project since first year, including rebases and conflict fixes."
        : null,
  }));

  const targetDate = new Date(now.getFullYear() + 1, 4, 1);

  const roadmap = [
    { id: "d-rm-1", title: "Finish the DBMS indexing chapter and write notes", dueDate: daysAgo(now, -9), done: true, order: 0 },
    { id: "d-rm-2", title: "Build a REST API with auth and tests", dueDate: daysAgo(now, -24), done: false, order: 1 },
    { id: "d-rm-3", title: "Learn Docker well enough to containerise it", dueDate: daysAgo(now, -45), done: false, order: 2 },
    { id: "d-rm-4", title: "Solve 50 more DSA problems, medium and up", dueDate: null, done: false, order: 3 },
    /* One overdue on purpose, so the "behind" state is visible in the demo. */
    { id: "d-rm-5", title: "Write up the hostel-mess project as a case study", dueDate: daysAgo(now, 6), done: false, order: 4 },
  ];

  return {
    goal: {
      id: "d-goal-1",
      targetRole: "Backend developer",
      targetDate: isoDate(targetDate),
      daysAway: daysToTarget(targetDate, now),
      requirements,
    },

    skills,
    gap: skillGap(requirements, skills),

    certifications: [
      {
        id: "d-cert-1",
        name: "Relational databases, course certificate",
        issuer: "NPTEL",
        date: daysAgo(now, 120),
        url: null,
      },
    ],

    projects: [
      {
        id: "d-proj-1",
        title: "Hostel mess menu tracker",
        description:
          "A small app the hostel actually used for a semester. Node, Postgres, and a weekly cron that mailed the menu.",
        skills: ["Node", "Postgres", "Cron"],
        url: null,
        status: "SHIPPED",
      },
      {
        id: "d-proj-2",
        title: "Attendance predictor",
        description: "Works out how many classes can still be missed. Half built.",
        skills: ["Python", "Pandas"],
        url: null,
        status: "BUILDING",
      },
    ],

    placement: {
      stage: "PREPARING",
      notes: "Campus placements open in August. Two companies shortlist on DSA first.",
      progress: placementProgress("PREPARING"),
    },

    roadmap,
    roadmapProgress: roadmapProgress(roadmap, now),
  };
}
