import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import {
  addExpense,
  addInvestment,
  addSavingsGoal,
  addSubscription,
  deleteExpense,
  deleteInvestment,
  deleteSavingsGoal,
  deleteSubscription,
  saveFinanceProfile,
  updateSavings,
} from "@/app/(app)/finance/actions";
import { BarRows, ProgressRing, TrendChart } from "@/components/patterns/charts";
import { DeleteButton } from "@/components/patterns/delete-button";
import { ModuleTabs } from "@/components/patterns/module-tabs";
import { PageHeader } from "@/components/patterns/page-header";
import { StatusChip } from "@/components/patterns/status-chip";
import { EmptyState, GridSkeleton } from "@/components/patterns/states";
import {
  BudgetForm,
  ExpenseForm,
  InvestmentForm,
  SavingsGoalForm,
  SavingsUpdateForm,
  SubscriptionForm,
} from "@/components/finance/finance-forms";
import { getFinanceRepo } from "@/lib/data/repo";
import { isoDate } from "@/lib/domain/calc/health";
import { formatMinor, type BudgetStatus } from "@/lib/domain/calc/finance";
import type { FinanceView } from "@/lib/data/finance.repo";
import type { Status } from "@/lib/domain/types";

export const metadata: Metadata = { title: "Finance" };

export default function FinancePage() {
  return (
    <Suspense fallback={<GridSkeleton count={4} />}>
      <FinanceContent />
    </Suspense>
  );
}

async function FinanceContent() {
  /*
   * Opt into request-time rendering *before* reading the clock.
   *
   * With `cacheComponents` on, Next prerenders what it can, and `new Date()`
   * in a prerender is a value that would be frozen into the HTML — so it
   * refuses it outright. The repo awaits `connection()` too, but that happens
   * after this component has already called the constructor, which is too
   * late. One line here, and the page is honestly dynamic: "today" and
   * "good evening" are only true for one request anyway.
   */
  await connection();

  const repo = await getFinanceRepo();
  const now = new Date();
  const view = await repo.getFinance(now);
  const today = isoDate(now);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Where the month is going, and where it is heading if nothing changes. Tracking only — every figure here is one you entered."
        askAbout="my spending this month"
      />

      <ModuleTabs
        tabs={[
          { value: "month", label: "This month", content: <MonthTab view={view} today={today} /> },
          {
            value: "subscriptions",
            label: "Subscriptions",
            content: <SubscriptionsTab view={view} today={today} />,
          },
          { value: "savings", label: "Savings", content: <SavingsTab view={view} /> },
          { value: "investments", label: "Investments", content: <InvestmentsTab view={view} /> },
          {
            value: "setup",
            label: "Income & budget",
            content: (
              <BudgetForm
                action={saveFinanceProfile}
                monthlyIncomeMinor={view.profile.monthlyIncomeMinor}
                monthlyBudgetMinor={view.profile.monthlyBudgetMinor}
              />
            ),
          },
        ]}
      />

      <p className="text-muted-foreground border-t pt-4 text-xs">
        Tracking only — not financial advice. The month-end figure is arithmetic on a
        partial month, not a forecast, and nothing here recommends a course of action.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 this month                                 */
/* -------------------------------------------------------------------------- */

/** The projection's status, mapped onto the product's four status bands. */
const STATUS_BAND: Record<BudgetStatus, { band: Status; label: string }> = {
  "on-track": { band: "ok", label: "On track" },
  "at-risk": { band: "attention", label: "At risk" },
  over: { band: "risk", label: "Over budget" },
};

function MonthTab({ view, today }: { view: FinanceView; today: string }) {
  const { projection, categories, expenses, cumulative } = view;
  const status = STATUS_BAND[projection.status];

  const thisMonth = expenses.filter((expense) => {
    const date = new Date(expense.date);
    const now = new Date(today);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });

  /* Actual is solid up to today; the projection continues it dashed. A single
     solid line to month end would imply we know what has not happened yet. */
  const actual = cumulative
    .slice(0, projection.daysElapsed)
    .map((point) => point.cumulativeMinor / 100);

  const projected = [
    ...new Array(Math.max(projection.daysElapsed - 1, 0)).fill(null),
    actual[actual.length - 1] ?? 0,
    ...Array.from({ length: projection.daysInMonth - projection.daysElapsed }, (_, index) => {
      const step = (projection.projectedMinor - projection.spentMinor) /
        Math.max(projection.daysInMonth - projection.daysElapsed, 1);
      return (projection.spentMinor + step * (index + 1)) / 100;
    }),
  ].filter((value): value is number => value !== null);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <ExpenseForm action={addExpense} today={today} />

        <section aria-labelledby="expenses-heading" className="space-y-3">
          <h2 id="expenses-heading" className="text-base font-medium">
            This month&rsquo;s expenses
          </h2>

          {thisMonth.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Nothing recorded this month"
              purpose="Add an expense above and this fills in: where the money went by category, and where the month is heading at your current rate."
              action={
                <p className="text-muted-foreground text-xs">
                  Amount, a category chip, save. Three taps.
                </p>
              }
            />
          ) : (
            <ul className="space-y-2">
              {thisMonth.map((expense) => (
                <li
                  key={expense.id}
                  className="bg-card shadow-card flex items-center gap-3 rounded-xl border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {formatMinor(expense.amountMinor)}
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · {expense.category}
                      </span>
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {new Date(expense.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                      {expense.note && ` · ${expense.note}`}
                      {` · ${paymentLabel(expense.paymentMethod)}`}
                    </p>
                  </div>

                  <DeleteButton
                    action={deleteExpense}
                    name="expenseId"
                    id={expense.id}
                    label={`the ${formatMinor(expense.amountMinor)} ${expense.category} expense`}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="space-y-6">
        <section
          aria-labelledby="budget-heading"
          className="bg-card shadow-card rounded-xl border p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <h2 id="budget-heading" className="text-sm font-medium">
              {new Date(today).toLocaleDateString("en-IN", { month: "long" })}
            </h2>
            {projection.budgetMinor > 0 && (
              <StatusChip kind={status.band}>{status.label}</StatusChip>
            )}
          </div>

          {projection.budgetMinor === 0 ? (
            <p className="text-muted-foreground mt-2 text-xs">
              Set a monthly budget on the Income &amp; budget tab and this shows how the
              month is tracking against it.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <ProgressRing
                value={projection.spentMinor}
                max={projection.budgetMinor}
                centre={formatMinor(projection.spentMinor)}
                sub={`of ${formatMinor(projection.budgetMinor)}`}
                label={`${formatMinor(projection.spentMinor)} spent of a ${formatMinor(
                  projection.budgetMinor,
                )} budget`}
              />
              <div className="text-xs">
                <p>
                  <span className="text-muted-foreground">Heading for </span>
                  <span className="tabular font-mono font-medium">
                    {formatMinor(projection.projectedMinor)}
                  </span>
                </p>
                <p className="text-muted-foreground mt-1">
                  Day {projection.daysElapsed} of {projection.daysInMonth}
                </p>
                {projection.upcomingRenewalsMinor > 0 && (
                  <p className="text-muted-foreground mt-1">
                    Includes {formatMinor(projection.upcomingRenewalsMinor)} of renewals
                    still due
                  </p>
                )}
              </div>
            </div>
          )}

          <p className="text-muted-foreground mt-3 border-t pt-2 text-2xs leading-relaxed">
            {projection.method}
          </p>
        </section>

        {thisMonth.length > 0 && (
          <>
            <section
              aria-labelledby="cat-heading"
              className="bg-card shadow-card rounded-xl border p-4"
            >
              <h2 id="cat-heading" className="text-sm font-medium">
                Where it went
              </h2>
              <div className="mt-3">
                <BarRows
                  rows={categories.map((row, index) => ({
                    label: row.category,
                    value: row.totalMinor,
                    target: categories[0]?.totalMinor,
                    display: formatMinor(row.totalMinor),
                    note: `${Math.round(row.share * 100)}%`,
                    /* Only the largest category gets the accent. */
                    emphasis: index === 0,
                  }))}
                  caption="Largest first. Only the biggest category is highlighted."
                />
              </div>
            </section>

            <section className="bg-card shadow-card rounded-xl border p-4">
              <h2 className="text-sm font-medium">Running total</h2>
              <p className="text-muted-foreground mt-0.5 mb-2 text-xs">
                Solid is what you have spent. Dashed is the same rate carried to month end.
              </p>
              <TrendChart
                series={[
                  { label: "Spent (₹)", values: actual, emphasis: true },
                  { label: "At this rate (₹)", values: projected, projected: true },
                ]}
                labels={cumulative.map((point) => String(point.day))}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function paymentLabel(method: string): string {
  if (method === "NETBANKING") return "Net banking";
  return method.charAt(0) + method.slice(1).toLowerCase();
}

/* -------------------------------------------------------------------------- */
/*                                subscriptions                               */
/* -------------------------------------------------------------------------- */

function SubscriptionsTab({ view, today }: { view: FinanceView; today: string }) {
  const { subscriptions, annualSubscriptionMinor } = view;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section
        aria-labelledby="subs-heading"
        className="bg-card shadow-card rounded-xl border p-4"
      >
        <h2 id="subs-heading" className="text-base font-medium">
          Subscriptions
        </h2>
        <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
          Renewals falling before month end are added to the projection as known amounts,
          not guesses.
        </p>

        <SubscriptionForm action={addSubscription} today={today} />

        {subscriptions.length === 0 ? (
          <p className="text-muted-foreground mt-4 border-t pt-4 text-xs">
            Nothing added yet. These are the charges that catch people out, so they are
            counted separately from everyday spending.
          </p>
        ) : (
          <ul className="mt-4 space-y-2 border-t pt-4">
            {subscriptions.map((subscription) => (
              <li key={subscription.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {subscription.name}
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {formatMinor(subscription.amountMinor)}{" "}
                      {subscription.cycle === "YEARLY" ? "a year" : "a month"}
                    </span>
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {subscription.daysAway < 0
                      ? `Renewal date was ${Math.abs(subscription.daysAway)} days ago — update it`
                      : subscription.daysAway === 0
                        ? "Renews today"
                        : `Renews in ${subscription.daysAway} day${
                            subscription.daysAway === 1 ? "" : "s"
                          }`}
                  </p>
                </div>

                <DeleteButton
                  action={deleteSubscription}
                  name="subscriptionId"
                  id={subscription.id}
                  label={subscription.name}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {subscriptions.length > 0 && (
        <section className="bg-card shadow-card rounded-xl border p-4">
          <h2 className="text-sm font-medium">Over a year</h2>
          <p className="tabular mt-2 font-mono text-2xl font-medium">
            {formatMinor(annualSubscriptionMinor)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Monthly and yearly charges normalised to twelve months. Stated because a
            monthly figure hides how much these add up to.
          </p>
        </section>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   savings                                  */
/* -------------------------------------------------------------------------- */

function SavingsTab({ view }: { view: FinanceView }) {
  const { savingsGoals } = view;

  return (
    <section
      aria-labelledby="savings-heading"
      className="bg-card shadow-card rounded-xl border p-4"
    >
      <h2 id="savings-heading" className="text-base font-medium">
        Savings goals
      </h2>
      <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
        What you are putting money aside for, and what it would take each month to get
        there on time.
      </p>

      <SavingsGoalForm action={addSavingsGoal} />

      {savingsGoals.length === 0 ? (
        <p className="text-muted-foreground mt-4 border-t pt-4 text-xs">
          No goals yet. A goal with a date gets a monthly figure; one without is just a
          total to work towards.
        </p>
      ) : (
        <ul className="mt-4 space-y-4 border-t pt-4">
          {savingsGoals.map((goal) => (
            <li key={goal.id} className="flex flex-wrap items-start gap-4">
              <div className="min-w-[12rem] flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{goal.name}</p>
                  <p className="text-muted-foreground tabular font-mono text-xs">
                    {formatMinor(goal.savedMinor)} / {formatMinor(goal.targetMinor)}
                  </p>
                </div>

                <span className="bg-muted relative mt-1.5 block h-2 overflow-hidden rounded-full border">
                  <span
                    className="bg-accent absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${(goal.progress ?? 0) * 100}%` }}
                  />
                </span>

                <p className="text-muted-foreground mt-1.5 text-xs">
                  {goal.progress !== null && goal.progress >= 1
                    ? "Reached."
                    : goal.monthlyNeededMinor !== null
                      ? `${formatMinor(goal.monthlyNeededMinor)} a month to make ${
                          goal.deadline
                            ? new Date(goal.deadline).toLocaleDateString("en-IN", {
                                month: "long",
                                year: "numeric",
                              })
                            : "the deadline"
                        }`
                      : goal.deadline
                        ? "That date has passed — set a new one."
                        : "No deadline set."}
                </p>
              </div>

              <SavingsUpdateForm
                action={updateSavings}
                goalId={goal.id}
                savedMinor={goal.savedMinor}
              />

              <DeleteButton
                action={deleteSavingsGoal}
                name="goalId"
                id={goal.id}
                label={goal.name}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                investments                                 */
/* -------------------------------------------------------------------------- */

const KIND_LABELS: Record<string, string> = {
  STOCK: "Stock",
  MUTUAL_FUND: "Mutual fund",
  FD: "Fixed deposit",
  SIP: "SIP",
};

function InvestmentsTab({ view }: { view: FinanceView }) {
  const { investments, investmentSummary: summary, livePrices } = view;

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="inv-heading"
        className="bg-card shadow-card rounded-xl border p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="inv-heading" className="text-base font-medium">
              Investments
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Values are the ones you entered. Nothing here is a recommendation.
            </p>
          </div>

          {/* Stated plainly rather than implied by a missing number. */}
          <span className="text-muted-foreground bg-muted rounded-full border px-2.5 py-0.5 text-2xs font-medium">
            {livePrices ? "Live prices: connected" : "Live prices: not connected"}
          </span>
        </div>

        <div className="mt-3">
          <InvestmentForm action={addInvestment} />
        </div>

        {investments.length === 0 ? (
          <p className="text-muted-foreground mt-4 border-t pt-4 text-xs">
            Nothing added yet. A fixed deposit gets its maturity worked out, because its
            rate is fixed. Nothing else is projected.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto border-t pt-4">
            <table className="w-full min-w-[34rem] text-xs">
              <thead>
                <tr className="border-b text-left">
                  <th scope="col" className="py-1.5 font-medium">
                    Holding
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    Invested
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    Value now
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    Change
                  </th>
                  <th scope="col" className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {investments.map((holding) => {
                  const change = holding.currentMinor - holding.investedMinor;
                  const hasValue = holding.currentMinor > 0;

                  return (
                    <tr key={holding.id} className="border-b last:border-0">
                      <td className="py-2">
                        <span className="font-medium">{holding.name}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {KIND_LABELS[holding.kind] ?? holding.kind}
                        </span>
                        {holding.maturity && (
                          <p className="text-muted-foreground text-2xs">
                            At {holding.interestRate}% quarterly, a year comes to{" "}
                            {formatMinor(holding.maturity.maturityMinor)}
                          </p>
                        )}
                        {holding.sipAmountMinor && (
                          <p className="text-muted-foreground text-2xs">
                            {formatMinor(holding.sipAmountMinor)} on day {holding.sipDay}
                          </p>
                        )}
                      </td>
                      <td className="tabular py-2 text-right font-mono">
                        {formatMinor(holding.investedMinor)}
                      </td>
                      <td className="tabular py-2 text-right font-mono">
                        {hasValue ? formatMinor(holding.currentMinor) : "—"}
                      </td>
                      <td
                        className={`tabular py-2 text-right font-mono ${
                          !hasValue || change === 0
                            ? "text-muted-foreground"
                            : change > 0
                              ? "text-ok"
                              : "text-risk"
                        }`}
                      >
                        {hasValue
                          ? `${change > 0 ? "+" : ""}${formatMinor(change)}`
                          : "not set"}
                      </td>
                      <td className="py-2 text-right">
                        <DeleteButton
                          action={deleteInvestment}
                          name="investmentId"
                          id={holding.id}
                          label={holding.name}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td className="py-2">Total</td>
                  <td className="tabular py-2 text-right font-mono">
                    {formatMinor(summary.investedMinor)}
                  </td>
                  <td className="tabular py-2 text-right font-mono">
                    {formatMinor(summary.currentMinor)}
                  </td>
                  <td
                    className={`tabular py-2 text-right font-mono ${
                      summary.gainMinor === 0
                        ? "text-muted-foreground"
                        : summary.gainMinor > 0
                          ? "text-ok"
                          : "text-risk"
                    }`}
                  >
                    {summary.gainMinor > 0 ? "+" : ""}
                    {formatMinor(summary.gainMinor)}
                    {summary.gainPct !== null && (
                      <span className="text-muted-foreground">
                        {" "}
                        ({(summary.gainPct * 100).toFixed(1)}%)
                      </span>
                    )}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>

            <p className="text-muted-foreground mt-3 text-2xs leading-relaxed">
              A holding with no value entered is counted at what you put in, so a fresh
              entry does not read as a total loss.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
