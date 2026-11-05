/**
 * The Finance module's data boundary.
 *
 * Every amount that leaves this file is paise in an integer, exactly as it is
 * stored. Formatting to rupees happens in the components, through
 * `formatMinor`, so there is no point in the stack where money is a float.
 */

import { connection } from "next/server";

import { financeView } from "@/lib/data/module-fixtures";
import { getPrisma } from "@/lib/db";
import { isoCalendarDate } from "@/lib/domain/calc/health";
import {
  annualSubscriptionCost,
  dailyCumulative,
  fdMaturity,
  investmentSummary,
  monthlyToReachGoal,
  projectedMonthEnd,
  savingsProgress,
  spendByCategory,
  type BillingCycle,
  type CategoryTotal,
  type InvestmentKind,
  type InvestmentSummary,
  type Projection,
} from "@/lib/domain/calc/finance";
import { livePricesConnected } from "@/lib/integrations/prices";
import type {
  ExpenseInput,
  FinanceProfileInput,
  InvestmentInput,
  SavingsGoalInput,
  SubscriptionInput,
} from "@/lib/validation/finance";

/* -------------------------------------------------------------------------- */
/*                                   views                                    */
/* -------------------------------------------------------------------------- */

export type ExpenseView = {
  id: string;
  date: string;
  category: string;
  amountMinor: number;
  note?: string;
  paymentMethod: string;
};

export type SubscriptionView = {
  id: string;
  name: string;
  amountMinor: number;
  cycle: BillingCycle;
  nextRenewal: string;
  /** Days until the next charge. Negative when it is overdue in our records. */
  daysAway: number;
};

export type SavingsGoalView = {
  id: string;
  name: string;
  targetMinor: number;
  savedMinor: number;
  deadline: string | null;
  /** 0–1, or null when the target is zero. */
  progress: number | null;
  /** What to put aside monthly to make the deadline, or null. */
  monthlyNeededMinor: number | null;
};

export type InvestmentView = {
  id: string;
  kind: InvestmentKind;
  name: string;
  symbol: string | null;
  units: number;
  investedMinor: number;
  currentMinor: number;
  interestRate: number | null;
  sipAmountMinor: number | null;
  sipDay: number | null;
  startDate: string | null;
  /** Only for fixed deposits, where the arithmetic is contractual. */
  maturity: { maturityMinor: number; interestMinor: number } | null;
};

export type FinanceView = {
  profile: { monthlyIncomeMinor: number; monthlyBudgetMinor: number; currency: string };
  expenses: ExpenseView[];
  categories: CategoryTotal[];
  projection: Projection;
  cumulative: { day: number; cumulativeMinor: number }[];
  subscriptions: SubscriptionView[];
  annualSubscriptionMinor: number;
  savingsGoals: SavingsGoalView[];
  investments: InvestmentView[];
  investmentSummary: InvestmentSummary;
  /** False until a market-data provider is configured. */
  livePrices: boolean;
};

export type FinanceRepo = {
  getFinance(now?: Date): Promise<FinanceView>;
  saveProfile(input: FinanceProfileInput): Promise<void>;
  addExpense(input: ExpenseInput): Promise<{ id: string }>;
  deleteExpense(expenseId: string): Promise<void>;
  addSubscription(input: SubscriptionInput): Promise<void>;
  deleteSubscription(subscriptionId: string): Promise<void>;
  addSavingsGoal(input: SavingsGoalInput): Promise<void>;
  updateSavings(goalId: string, savedMinor: number): Promise<void>;
  deleteSavingsGoal(goalId: string): Promise<void>;
  addInvestment(input: InvestmentInput): Promise<void>;
  deleteInvestment(investmentId: string): Promise<void>;
};

/* -------------------------------------------------------------------------- */
/*                                  per user                                  */
/* -------------------------------------------------------------------------- */

export function financeRepoForUser(userId: string): FinanceRepo {
  const prisma = getPrisma();

  return {
    async getFinance(now = new Date()) {
      await connection();

      /* Three months of expenses: enough for this month's figures and for the
         comparison the category list implies, without reading a year. */
      const since = new Date(now.getFullYear(), now.getMonth() - 2, 1);

      const [profile, expenses, subscriptions, goals, investments] = await Promise.all([
        prisma.financeProfile.findUnique({ where: { userId } }),
        prisma.expense.findMany({
          where: { userId, date: { gte: since } },
          orderBy: { date: "desc" },
        }),
        prisma.subscription.findMany({
          where: { userId },
          orderBy: { nextRenewal: "asc" },
        }),
        prisma.savingsGoal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
        prisma.investment.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      ]);

      const expenseViews: ExpenseView[] = expenses.map((row) => ({
        id: row.id,
        date: isoCalendarDate(row.date),
        category: row.category,
        amountMinor: row.amountMinor,
        note: row.note ?? undefined,
        paymentMethod: row.paymentMethod,
      }));

      const subscriptionRows = subscriptions.map((row) => ({
        name: row.name,
        amountMinor: row.amountMinor,
        cycle: row.cycle as BillingCycle,
        nextRenewal: isoCalendarDate(row.nextRenewal),
      }));

      return {
        profile: {
          monthlyIncomeMinor: profile?.monthlyIncomeMinor ?? 0,
          monthlyBudgetMinor: profile?.monthlyBudgetMinor ?? 0,
          currency: profile?.currency ?? "INR",
        },

        expenses: expenseViews,
        categories: spendByCategory(expenseViews, now),
        projection: projectedMonthEnd(
          expenseViews,
          profile?.monthlyBudgetMinor ?? 0,
          now,
          subscriptionRows,
        ),
        cumulative: dailyCumulative(expenseViews, now),

        subscriptions: subscriptions.map((row) => ({
          id: row.id,
          name: row.name,
          amountMinor: row.amountMinor,
          cycle: row.cycle as BillingCycle,
          nextRenewal: isoCalendarDate(row.nextRenewal),
          daysAway: daysBetween(now, row.nextRenewal),
        })),
        annualSubscriptionMinor: annualSubscriptionCost(subscriptionRows),

        savingsGoals: goals.map((row) => ({
          id: row.id,
          name: row.name,
          targetMinor: row.targetMinor,
          savedMinor: row.savedMinor,
          deadline: row.deadline ? isoCalendarDate(row.deadline) : null,
          progress: savingsProgress(row.savedMinor, row.targetMinor),
          monthlyNeededMinor: monthlyToReachGoal(
            row.savedMinor,
            row.targetMinor,
            row.deadline,
            now,
          ),
        })),

        investments: investments.map((row) => ({
          id: row.id,
          kind: row.kind as InvestmentKind,
          name: row.name,
          symbol: row.symbol,
          units: row.units,
          investedMinor: row.investedMinor,
          currentMinor: row.currentMinor,
          interestRate: row.interestRate,
          sipAmountMinor: row.sipAmountMinor,
          sipDay: row.sipDay,
          startDate: row.startDate ? isoCalendarDate(row.startDate) : null,
          /* Only an FD has a knowable future value: its rate is fixed when it
             is opened. Nothing else gets a projection. */
          maturity:
            row.kind === "FD" && row.interestRate && row.startDate
              ? fdMaturity(row.investedMinor, row.interestRate, 1, "quarterly")
              : null,
        })),
        investmentSummary: investmentSummary(
          investments.map((row) => ({
            kind: row.kind as InvestmentKind,
            name: row.name,
            investedMinor: row.investedMinor,
            currentMinor: row.currentMinor,
            interestRate: row.interestRate,
            sipAmountMinor: row.sipAmountMinor,
            startDate: row.startDate ? isoCalendarDate(row.startDate) : null,
          })),
        ),

        livePrices: livePricesConnected(),
      };
    },

    async saveProfile(input) {
      await prisma.financeProfile.upsert({
        where: { userId },
        create: { userId, ...input },
        update: input,
      });
    },

    async addExpense(input) {
      return prisma.expense.create({
        data: {
          userId,
          date: input.date,
          category: input.category,
          amountMinor: input.amountMinor,
          note: input.note ?? null,
          paymentMethod: input.paymentMethod,
        },
        select: { id: true },
      });
    },

    async deleteExpense(expenseId) {
      await prisma.expense.deleteMany({ where: { id: expenseId, userId } });
    },

    async addSubscription(input) {
      await prisma.subscription.create({
        data: {
          userId,
          name: input.name,
          amountMinor: input.amountMinor,
          cycle: input.cycle,
          nextRenewal: input.nextRenewal,
        },
      });
    },

    async deleteSubscription(subscriptionId) {
      await prisma.subscription.deleteMany({ where: { id: subscriptionId, userId } });
    },

    async addSavingsGoal(input) {
      await prisma.savingsGoal.create({
        data: {
          userId,
          name: input.name,
          targetMinor: input.targetMinor,
          savedMinor: input.savedMinor,
          deadline: input.deadline ?? null,
        },
      });
    },

    async updateSavings(goalId, savedMinor) {
      await prisma.savingsGoal.updateMany({
        where: { id: goalId, userId },
        data: { savedMinor },
      });
    },

    async deleteSavingsGoal(goalId) {
      await prisma.savingsGoal.deleteMany({ where: { id: goalId, userId } });
    },

    async addInvestment(input) {
      await prisma.investment.create({
        data: {
          userId,
          kind: input.kind,
          name: input.name,
          symbol: input.symbol ?? null,
          units: input.units,
          investedMinor: input.investedMinor,
          currentMinor: input.currentMinor,
          interestRate: input.interestRate ?? null,
          sipAmountMinor: input.sipAmountMinor ?? null,
          sipDay: input.sipDay ?? null,
          startDate: input.startDate ?? null,
        },
      });
    },

    async deleteInvestment(investmentId) {
      await prisma.investment.deleteMany({ where: { id: investmentId, userId } });
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                    demo                                    */
/* -------------------------------------------------------------------------- */

export const demoFinanceRepo: FinanceRepo = {
  async getFinance(now = new Date()) {
    await connection();
    return financeView(now);
  },

  async saveProfile() {},
  async addExpense() {
    return { id: "demo-expense" };
  },
  async deleteExpense() {},
  async addSubscription() {},
  async deleteSubscription() {},
  async addSavingsGoal() {},
  async updateSavings() {},
  async deleteSavingsGoal() {},
  async addInvestment() {},
  async deleteInvestment() {},
};

/* -------------------------------------------------------------------------- */
/*                                   shared                                   */
/* -------------------------------------------------------------------------- */

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from);
  a.setHours(0, 0, 0, 0);
  const b = new Date(to);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
