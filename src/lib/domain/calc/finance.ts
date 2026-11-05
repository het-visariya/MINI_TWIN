/**
 * Money calculations. Pure: no Prisma, no React, no clock.
 *
 * Every amount crossing this file is **paise held in an integer**. Rupees as a
 * floating-point number is how a budget ends up three paise out and the user
 * cannot work out why: `0.1 + 0.2 !== 0.3`. Conversion to a displayable string
 * happens once, in `formatMinor`, at the edge.
 *
 * Nothing here is advice. The projection states its own method, the budget
 * status is a description rather than an instruction, and no function in this
 * file recommends a course of action.
 */

export type BillingCycle = "MONTHLY" | "YEARLY";

export type InvestmentKind = "STOCK" | "MUTUAL_FUND" | "FD" | "SIP";

export type ExpenseRow = {
  /** ISO date, or anything Date can parse. */
  date: string;
  category: string;
  amountMinor: number;
};

export type SubscriptionRow = {
  name: string;
  amountMinor: number;
  cycle: BillingCycle;
  /** ISO date of the next charge. */
  nextRenewal: string;
};

export type InvestmentRow = {
  kind: InvestmentKind;
  name: string;
  investedMinor: number;
  currentMinor: number;
  interestRate?: number | null;
  sipAmountMinor?: number | null;
  startDate?: string | null;
};

/* -------------------------------------------------------------------------- */
/*                                 formatting                                 */
/* -------------------------------------------------------------------------- */

/**
 * Paise to a rupee string with Indian digit grouping — ₹1,25,000, not
 * ₹125,000. `Intl` is given the locale rather than the grouping being done by
 * hand, so the lakh/crore placement is the platform's problem and not ours.
 */
export function formatMinor(amountMinor: number, currency = "INR"): string {
  const value = num(amountMinor) / 100;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    /* Whole rupees unless the amount genuinely has paise in it: a budget of
       ₹8,000.00 reads as noise. */
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Rupees as typed by the user to paise. Rounds, because ₹12.345 is not money. */
export function toMinor(rupees: number): number {
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

export function fromMinor(amountMinor: number): number {
  return num(amountMinor) / 100;
}

/* -------------------------------------------------------------------------- */
/*                                 categories                                 */
/* -------------------------------------------------------------------------- */

/** The categories the quick-add chips offer. Free text is still accepted. */
export const EXPENSE_CATEGORIES = [
  "Food",
  "Travel",
  "Rent",
  "Fees",
  "Books",
  "Phone",
  "Subscriptions",
  "Health",
  "Fun",
  "Other",
] as const;

export type CategoryTotal = {
  category: string;
  totalMinor: number;
  /** Share of the month's spend, 0–1. Zero when nothing was spent. */
  share: number;
  count: number;
};

/**
 * Spend per category for the calendar month containing `month`, largest first.
 * The biggest category is what the chart paints in the accent colour, so the
 * ordering is part of the contract rather than a convenience.
 */
export function spendByCategory(expenses: ExpenseRow[], month: Date): CategoryTotal[] {
  const inMonth = expensesInMonth(expenses, month);

  const totals = new Map<string, { totalMinor: number; count: number }>();
  for (const expense of inMonth) {
    const key = expense.category?.trim() || "Other";
    const current = totals.get(key) ?? { totalMinor: 0, count: 0 };
    current.totalMinor += Math.round(num(expense.amountMinor));
    current.count += 1;
    totals.set(key, current);
  }

  const grand = [...totals.values()].reduce((sum, row) => sum + row.totalMinor, 0);

  return [...totals.entries()]
    .map(([category, row]) => ({
      category,
      totalMinor: row.totalMinor,
      share: grand === 0 ? 0 : round(row.totalMinor / grand, 4),
      count: row.count,
    }))
    .sort((a, b) => b.totalMinor - a.totalMinor);
}

export function monthTotal(expenses: ExpenseRow[], month: Date): number {
  return expensesInMonth(expenses, month).reduce(
    (sum, expense) => sum + Math.round(num(expense.amountMinor)),
    0,
  );
}

function expensesInMonth(expenses: ExpenseRow[], month: Date): ExpenseRow[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  return expenses.filter((expense) => {
    const date = new Date(expense.date);
    if (Number.isNaN(date.getTime())) return false;
    return date.getFullYear() === year && date.getMonth() === monthIndex;
  });
}

/* -------------------------------------------------------------------------- */
/*                                 projection                                 */
/* -------------------------------------------------------------------------- */

export type BudgetStatus = "on-track" | "at-risk" | "over";

export type Projection = {
  spentMinor: number;
  /** Spend plus the run-rate for the rest of the month, plus known renewals. */
  projectedMinor: number;
  budgetMinor: number;
  daysElapsed: number;
  daysInMonth: number;
  /** Renewals falling between today and month end, which are not a guess. */
  upcomingRenewalsMinor: number;
  status: BudgetStatus;
  /** The method, in one sentence, shown next to the number. */
  method: string;
};

/**
 * Where the month is heading.
 *
 * A linear run-rate on what has actually been spent, plus the subscription
 * renewals that fall before the month ends — those are known, not projected,
 * so they are added rather than extrapolated. Day one divides by one, not by
 * zero: `daysElapsed` is at least 1 by construction.
 *
 * Projected spend is never shown as a solid line in the UI; it is dashed,
 * because it is arithmetic on a partial month and not a forecast.
 */
export function projectedMonthEnd(
  expenses: ExpenseRow[],
  budgetMinor: number,
  today: Date,
  subscriptions: SubscriptionRow[] = [],
): Projection {
  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();

  const daysElapsed = Math.min(Math.max(today.getDate(), 1), daysInMonth);

  const spentMinor = monthTotal(expenses, today);
  const upcomingRenewalsMinor = renewalsBeforeMonthEnd(subscriptions, today);

  const runRate = spentMinor / daysElapsed;
  const projectedMinor =
    Math.round(runRate * daysInMonth) + upcomingRenewalsMinor;

  const budget = Math.round(num(budgetMinor));

  return {
    spentMinor,
    projectedMinor,
    budgetMinor: budget,
    daysElapsed,
    daysInMonth,
    upcomingRenewalsMinor,
    status: budgetStatus(spentMinor, projectedMinor, budget),
    method:
      "Your spend so far divided by the days gone, spread across the whole month, plus renewals still due.",
  };
}

/**
 * On track, at risk, or over.
 *
 * "Over" means already past the budget — a fact. "At risk" means the
 * projection crosses it — arithmetic, flagged as such. With no budget set
 * there is nothing to be over, so the answer is "on track" rather than an
 * invented judgement.
 */
export function budgetStatus(
  spentMinor: number,
  projectedMinor: number,
  budgetMinor: number,
): BudgetStatus {
  if (budgetMinor <= 0) return "on-track";
  if (spentMinor > budgetMinor) return "over";
  if (projectedMinor > budgetMinor) return "at-risk";
  return "on-track";
}

/** Renewals strictly after today and on or before the last of the month. */
export function renewalsBeforeMonthEnd(
  subscriptions: SubscriptionRow[],
  today: Date,
): number {
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);
  const from = startOfDay(today).getTime();

  return subscriptions.reduce((sum, subscription) => {
    const renewal = new Date(subscription.nextRenewal);
    if (Number.isNaN(renewal.getTime())) return sum;

    const at = startOfDay(renewal).getTime();
    if (at < from || at > monthEnd.getTime()) return sum;

    return sum + Math.round(num(subscription.amountMinor));
  }, 0);
}

/** What the subscriptions cost over a year, normalised across cycles. */
export function annualSubscriptionCost(subscriptions: SubscriptionRow[]): number {
  return subscriptions.reduce((sum, subscription) => {
    const amount = Math.round(num(subscription.amountMinor));
    return sum + (subscription.cycle === "YEARLY" ? amount : amount * 12);
  }, 0);
}

/** A month's worth of daily cumulative spend, for the actual-vs-projected line. */
export function dailyCumulative(
  expenses: ExpenseRow[],
  month: Date,
): { day: number; cumulativeMinor: number }[] {
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();

  const perDay = new Array<number>(daysInMonth + 1).fill(0);
  for (const expense of expensesInMonth(expenses, month)) {
    const day = new Date(expense.date).getDate();
    perDay[day] += Math.round(num(expense.amountMinor));
  }

  const series: { day: number; cumulativeMinor: number }[] = [];
  let running = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    running += perDay[day];
    series.push({ day, cumulativeMinor: running });
  }

  return series;
}

/* -------------------------------------------------------------------------- */
/*                                investments                                 */
/* -------------------------------------------------------------------------- */

export type CompoundingFrequency = "annually" | "half-yearly" | "quarterly" | "monthly";

const PERIODS_PER_YEAR: Record<CompoundingFrequency, number> = {
  annually: 1,
  "half-yearly": 2,
  quarterly: 4,
  monthly: 12,
};

/**
 * Fixed-deposit maturity: A = P × (1 + r/n)^(n × t).
 *
 * The contractual arithmetic of the deposit, not a prediction — an FD's rate
 * is fixed when it is opened, which is exactly why this can be computed
 * honestly while a stock's future value cannot.
 */
export function fdMaturity(
  principalMinor: number,
  annualRatePercent: number,
  years: number,
  compounding: CompoundingFrequency = "quarterly",
): { maturityMinor: number; interestMinor: number } | null {
  const principal = Math.round(num(principalMinor));
  if (principal <= 0) return null;
  if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0) return null;
  if (!Number.isFinite(years) || years <= 0) return null;

  const n = PERIODS_PER_YEAR[compounding] ?? 4;
  const rate = annualRatePercent / 100;

  const maturity = principal * Math.pow(1 + rate / n, n * years);
  const maturityMinor = Math.round(maturity);

  return { maturityMinor, interestMinor: maturityMinor - principal };
}

export type InvestmentSummary = {
  investedMinor: number;
  currentMinor: number;
  gainMinor: number;
  /** Fractional return, e.g. 0.085. Null when nothing has been invested. */
  gainPct: number | null;
  byKind: {
    kind: InvestmentKind;
    investedMinor: number;
    currentMinor: number;
    gainMinor: number;
  }[];
};

/**
 * Invested against current value.
 *
 * `currentMinor` is whatever the user last entered by hand. This function does
 * not know today's price and does not pretend to: the UI says "Live prices:
 * not connected" alongside it until a market-data provider is configured.
 */
export function investmentSummary(investments: InvestmentRow[]): InvestmentSummary {
  const byKind = new Map<
    InvestmentKind,
    { investedMinor: number; currentMinor: number }
  >();

  let investedMinor = 0;
  let currentMinor = 0;

  for (const investment of investments) {
    const invested = Math.round(num(investment.investedMinor));
    /* An unset current value means "unknown", and treating unknown as zero
       would show every fresh holding as a 100% loss. */
    const current =
      investment.currentMinor > 0 ? Math.round(num(investment.currentMinor)) : invested;

    investedMinor += invested;
    currentMinor += current;

    const bucket = byKind.get(investment.kind) ?? {
      investedMinor: 0,
      currentMinor: 0,
    };
    bucket.investedMinor += invested;
    bucket.currentMinor += current;
    byKind.set(investment.kind, bucket);
  }

  return {
    investedMinor,
    currentMinor,
    gainMinor: currentMinor - investedMinor,
    gainPct:
      investedMinor === 0
        ? null
        : round((currentMinor - investedMinor) / investedMinor, 4),
    byKind: [...byKind.entries()].map(([kind, row]) => ({
      kind,
      investedMinor: row.investedMinor,
      currentMinor: row.currentMinor,
      gainMinor: row.currentMinor - row.investedMinor,
    })),
  };
}

/** How far a savings goal has got, capped at 1 so an overshoot reads as done. */
export function savingsProgress(savedMinor: number, targetMinor: number): number | null {
  const target = Math.round(num(targetMinor));
  if (target <= 0) return null;
  return Math.min(1, round(Math.round(num(savedMinor)) / target, 4));
}

/**
 * What the user would need to put aside each month to hit a dated goal.
 * Null without a deadline, and null once the deadline has passed — there is no
 * honest monthly figure for a date that is already behind us.
 */
export function monthlyToReachGoal(
  savedMinor: number,
  targetMinor: number,
  deadline: Date | null,
  today: Date,
): number | null {
  if (!deadline) return null;

  const remaining = Math.round(num(targetMinor)) - Math.round(num(savedMinor));
  if (remaining <= 0) return 0;

  const months =
    (deadline.getFullYear() - today.getFullYear()) * 12 +
    (deadline.getMonth() - today.getMonth());

  if (months <= 0) return null;
  return Math.ceil(remaining / months);
}

/* -------------------------------------------------------------------------- */
/*                                   shared                                   */
/* -------------------------------------------------------------------------- */

function num(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function round(value: number, places = 0): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
