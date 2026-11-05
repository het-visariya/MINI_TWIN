/**
 * Finance input schemas.
 *
 * Every amount arrives as rupees from a form and leaves as paise, through
 * `rupeesToMinor`. Nothing downstream of this file handles a rupee float, and
 * nothing in the database stores one.
 */

import { z } from "zod";

import {
  boundedDate,
  optionalText,
  rupeesToMinor,
  shortText,
} from "@/lib/validation/shared";

export const paymentMethod = z.enum(["CASH", "UPI", "CARD", "NETBANKING", "OTHER"]);
export const billingCycle = z.enum(["MONTHLY", "YEARLY"]);
export const investmentKind = z.enum(["STOCK", "MUTUAL_FUND", "FD", "SIP"]);

export const financeProfileSchema = z.object({
  monthlyIncomeMinor: rupeesToMinor.default(0),
  monthlyBudgetMinor: rupeesToMinor.default(0),
  /** One currency for now; the column exists so adding another is a migration. */
  currency: z.literal("INR").default("INR"),
});

export const expenseSchema = z.object({
  date: boundedDate,
  category: shortText(40),
  amountMinor: rupeesToMinor.refine(
    (minor) => minor > 0,
    "An expense needs an amount above zero.",
  ),
  note: optionalText(200),
  paymentMethod: paymentMethod.default("UPI"),
});

export const deleteExpenseSchema = z.object({ expenseId: z.string().trim().min(1) });

export const subscriptionSchema = z.object({
  name: shortText(80),
  amountMinor: rupeesToMinor.refine(
    (minor) => minor > 0,
    "A subscription needs an amount above zero.",
  ),
  cycle: billingCycle.default("MONTHLY"),
  nextRenewal: boundedDate,
});

export const deleteSubscriptionSchema = z.object({
  subscriptionId: z.string().trim().min(1),
});

export const savingsGoalSchema = z.object({
  name: shortText(80),
  targetMinor: rupeesToMinor.refine(
    (minor) => minor > 0,
    "A savings goal needs a target above zero.",
  ),
  savedMinor: rupeesToMinor.default(0),
  deadline: boundedDate.optional(),
});

export const updateSavingsSchema = z.object({
  goalId: z.string().trim().min(1),
  savedMinor: rupeesToMinor,
});

export const deleteSavingsGoalSchema = z.object({ goalId: z.string().trim().min(1) });

/**
 * A holding.
 *
 * `currentMinor` is the user's own last-known value, which is why it is an
 * ordinary editable field: until a market-data provider is configured there is
 * nothing else it could be, and the UI says so rather than showing a stale
 * number as if it were live.
 */
export const investmentSchema = z
  .object({
    kind: investmentKind,
    name: shortText(80),
    symbol: optionalText(20),
    units: z.coerce.number().min(0).max(10_000_000).default(0),
    investedMinor: rupeesToMinor.default(0),
    currentMinor: rupeesToMinor.default(0),
    interestRate: z.coerce
      .number()
      .min(0, "A rate cannot be negative.")
      .max(100, "A rate above 100% is not something this app records.")
      .optional(),
    sipAmountMinor: rupeesToMinor.optional(),
    sipDay: z.coerce
      .number()
      .int()
      .min(1)
      .max(28, "Pick a day from 1 to 28 so it exists in every month.")
      .optional(),
    startDate: boundedDate.optional(),
  })
  .refine(
    (value) => value.kind !== "FD" || value.interestRate !== undefined,
    { message: "A fixed deposit needs its interest rate.", path: ["interestRate"] },
  )
  .refine(
    (value) => value.kind !== "SIP" || value.sipAmountMinor !== undefined,
    { message: "A SIP needs its instalment amount.", path: ["sipAmountMinor"] },
  );

export const deleteInvestmentSchema = z.object({
  investmentId: z.string().trim().min(1),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;
export type SavingsGoalInput = z.infer<typeof savingsGoalSchema>;
export type InvestmentInput = z.infer<typeof investmentSchema>;
export type FinanceProfileInput = z.infer<typeof financeProfileSchema>;
