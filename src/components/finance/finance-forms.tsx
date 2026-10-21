"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { ActionForm, FieldError, FormError } from "@/components/patterns/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "cn";
import { EXPENSE_CATEGORIES, fromMinor } from "@/lib/domain/calc/finance";
import type { ActionResult } from "@/lib/validation/shared";

/**
 * Add an expense in three taps: amount, a category chip, save.
 *
 * The category is a chip row rather than a dropdown because a dropdown costs
 * two interactions and hides the options. Payment method and note are there
 * but default sensibly, so the fast path stays three taps.
 */
export function ExpenseForm({
  action,
  today,
}: {
  action: (formData: FormData) => Promise<ActionResult<{ id: string }>>;
  today: string;
}) {
  const [category, setCategory] = useState<string>("Food");

  return (
    <ActionForm
      action={action}
      successMessage="Expense added."
      resetOnSuccess
      className="bg-card shadow-card space-y-3 rounded-xl border p-4"
    >
      {({ pending, fieldErrors, result }) => (
        <>
          <div>
            <h2 className="text-base font-medium">Add an expense</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Amount, category, save. Everything else is optional.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="w-32">
              <Label htmlFor="amount" className="text-xs">
                Amount (₹)
              </Label>
              <Input
                id="amount"
                name="amountMinor"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="250"
                required
                autoFocus
                aria-describedby={fieldErrors.amountMinor ? "amount-error" : undefined}
              />
            </div>

            <div className="w-36">
              <Label htmlFor="expense-date" className="text-xs">
                Date
              </Label>
              <Input
                id="expense-date"
                name="date"
                type="date"
                defaultValue={today}
                required
              />
            </div>

            <div className="w-32">
              <Label htmlFor="paymentMethod" className="text-xs">
                Paid by
              </Label>
              <Select name="paymentMethod" defaultValue="UPI">
                <SelectTrigger id="paymentMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["UPI", "CASH", "CARD", "NETBANKING", "OTHER"].map((method) => (
                    <SelectItem key={method} value={method}>
                      {method === "NETBANKING"
                        ? "Net banking"
                        : method.charAt(0) + method.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <FieldError id="amount-error" message={fieldErrors.amountMinor} />

          <fieldset>
            <legend className="text-xs font-medium">Category</legend>
            {/* The chosen chip is submitted through a hidden input, so the
                category is one tap rather than a select. */}
            <input type="hidden" name="category" value={category} />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {EXPENSE_CATEGORIES.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={category === option}
                  onClick={() => setCategory(option)}
                  className={cn(
                    category === option && "border-accent/50 bg-accent/10 text-accent",
                  )}
                >
                  {option}
                </Button>
              ))}
            </div>
            <FieldError message={fieldErrors.category} />
          </fieldset>

          <div>
            <Label htmlFor="note" className="text-xs">
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input id="note" name="note" placeholder="Canteen lunch" maxLength={200} />
          </div>

          <FormError result={result} />

          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Add expense"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

export function BudgetForm({
  action,
  monthlyIncomeMinor,
  monthlyBudgetMinor,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  monthlyIncomeMinor: number;
  monthlyBudgetMinor: number;
}) {
  return (
    <ActionForm
      action={action}
      successMessage="Saved."
      className="bg-card shadow-card space-y-3 rounded-xl border p-4"
    >
      {({ pending, fieldErrors, result }) => (
        <>
          <div>
            <h2 className="text-base font-medium">Income and budget</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Your own numbers. The projection is meaningless without the budget.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="monthlyIncomeMinor" className="text-xs">
                Monthly income (₹)
              </Label>
              <Input
                id="monthlyIncomeMinor"
                name="monthlyIncomeMinor"
                type="number"
                inputMode="decimal"
                step="1"
                min="0"
                defaultValue={monthlyIncomeMinor ? fromMinor(monthlyIncomeMinor) : ""}
                placeholder="10000"
              />
              <FieldError message={fieldErrors.monthlyIncomeMinor} />
            </div>

            <div>
              <Label htmlFor="monthlyBudgetMinor" className="text-xs">
                Monthly budget (₹)
              </Label>
              <Input
                id="monthlyBudgetMinor"
                name="monthlyBudgetMinor"
                type="number"
                inputMode="decimal"
                step="1"
                min="0"
                defaultValue={monthlyBudgetMinor ? fromMinor(monthlyBudgetMinor) : ""}
                placeholder="8000"
              />
              <FieldError message={fieldErrors.monthlyBudgetMinor} />
            </div>
          </div>

          <FormError result={result} />

          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

export function SubscriptionForm({
  action,
  today,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  today: string;
}) {
  return (
    <ActionForm
      action={action}
      successMessage="Subscription added."
      resetOnSuccess
      className="space-y-2"
    >
      {({ pending, fieldErrors, result }) => (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[8rem] flex-1">
              <Label htmlFor="sub-name" className="text-2xs">
                Name
              </Label>
              <Input id="sub-name" name="name" placeholder="Music streaming" required />
            </div>
            <div className="w-24">
              <Label htmlFor="sub-amount" className="text-2xs">
                ₹
              </Label>
              <Input
                id="sub-amount"
                name="amountMinor"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                required
              />
            </div>
            <div className="w-28">
              <Label htmlFor="sub-cycle" className="text-2xs">
                Cycle
              </Label>
              <Select name="cycle" defaultValue="MONTHLY">
                <SelectTrigger id="sub-cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Label htmlFor="sub-renewal" className="text-2xs">
                Next renewal
              </Label>
              <Input
                id="sub-renewal"
                name="nextRenewal"
                type="date"
                defaultValue={today}
                required
              />
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              <Plus aria-hidden />
              Add
            </Button>
          </div>

          <FieldError message={fieldErrors.name ?? fieldErrors.amountMinor} />
          <FormError result={result} />
        </>
      )}
    </ActionForm>
  );
}

export function SavingsGoalForm({
  action,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  return (
    <ActionForm
      action={action}
      successMessage="Goal added."
      resetOnSuccess
      className="space-y-2"
    >
      {({ pending, fieldErrors, result }) => (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[8rem] flex-1">
              <Label htmlFor="goal-name" className="text-2xs">
                Goal
              </Label>
              <Input id="goal-name" name="name" placeholder="Laptop upgrade" required />
            </div>
            <div className="w-28">
              <Label htmlFor="goal-target" className="text-2xs">
                Target ₹
              </Label>
              <Input
                id="goal-target"
                name="targetMinor"
                type="number"
                inputMode="decimal"
                step="1"
                min="0"
                required
              />
            </div>
            <div className="w-28">
              <Label htmlFor="goal-saved" className="text-2xs">
                Saved ₹
              </Label>
              <Input
                id="goal-saved"
                name="savedMinor"
                type="number"
                inputMode="decimal"
                step="1"
                min="0"
                defaultValue="0"
              />
            </div>
            <div className="w-36">
              <Label htmlFor="goal-deadline" className="text-2xs">
                By <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input id="goal-deadline" name="deadline" type="date" />
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              <Plus aria-hidden />
              Add
            </Button>
          </div>

          <FieldError message={fieldErrors.name ?? fieldErrors.targetMinor} />
          <FormError result={result} />
        </>
      )}
    </ActionForm>
  );
}

const KINDS = [
  { value: "SIP", label: "SIP" },
  { value: "MUTUAL_FUND", label: "Mutual fund" },
  { value: "STOCK", label: "Stock" },
  { value: "FD", label: "Fixed deposit" },
] as const;

/**
 * A holding.
 *
 * Which extra fields show depends on the kind, because an FD needs its rate
 * and a SIP needs its instalment — and the schema refuses without them, so
 * hiding them for the wrong kind would make the form unsubmittable rather
 * than merely untidy.
 */
export function InvestmentForm({
  action,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [kind, setKind] = useState<string>("SIP");

  return (
    <ActionForm
      action={action}
      successMessage="Holding added."
      resetOnSuccess
      className="space-y-2"
    >
      {({ pending, fieldErrors, result }) => (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-32">
              <Label htmlFor="inv-kind" className="text-2xs">
                Kind
              </Label>
              <Select name="kind" value={kind} onValueChange={setKind}>
                <SelectTrigger id="inv-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[8rem] flex-1">
              <Label htmlFor="inv-name" className="text-2xs">
                Name
              </Label>
              <Input id="inv-name" name="name" placeholder="Index fund" required />
            </div>

            <div className="w-28">
              <Label htmlFor="inv-invested" className="text-2xs">
                Invested ₹
              </Label>
              <Input
                id="inv-invested"
                name="investedMinor"
                type="number"
                inputMode="decimal"
                step="1"
                min="0"
                required
              />
            </div>

            <div className="w-28">
              <Label htmlFor="inv-current" className="text-2xs">
                Value now ₹
              </Label>
              <Input
                id="inv-current"
                name="currentMinor"
                type="number"
                inputMode="decimal"
                step="1"
                min="0"
              />
            </div>

            {kind === "FD" && (
              <div className="w-24">
                <Label htmlFor="inv-rate" className="text-2xs">
                  Rate %
                </Label>
                <Input
                  id="inv-rate"
                  name="interestRate"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                />
              </div>
            )}

            {kind === "SIP" && (
              <>
                <div className="w-28">
                  <Label htmlFor="inv-sip" className="text-2xs">
                    Instalment ₹
                  </Label>
                  <Input
                    id="inv-sip"
                    name="sipAmountMinor"
                    type="number"
                    inputMode="decimal"
                    step="1"
                    min="0"
                    required
                  />
                </div>
                <div className="w-20">
                  <Label htmlFor="inv-day" className="text-2xs">
                    Day
                  </Label>
                  <Input
                    id="inv-day"
                    name="sipDay"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="28"
                    defaultValue="5"
                  />
                </div>
              </>
            )}

            <div className="w-36">
              <Label htmlFor="inv-start" className="text-2xs">
                Started
              </Label>
              <Input id="inv-start" name="startDate" type="date" />
            </div>

            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              <Plus aria-hidden />
              Add
            </Button>
          </div>

          <FieldError
            message={
              fieldErrors.name ??
              fieldErrors.investedMinor ??
              fieldErrors.interestRate ??
              fieldErrors.sipAmountMinor
            }
          />
          <FormError result={result} />
        </>
      )}
    </ActionForm>
  );
}

/** Update how much is saved against a goal, inline. */
export function SavingsUpdateForm({
  action,
  goalId,
  savedMinor,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  goalId: string;
  savedMinor: number;
}) {
  return (
    <ActionForm action={action} successMessage="Updated.">
      {({ pending }) => (
        <div className="flex items-end gap-1.5">
          <input type="hidden" name="goalId" value={goalId} />
          <div className="w-24">
            <Label htmlFor={`saved-${goalId}`} className="text-2xs">
              Saved ₹
            </Label>
            <Input
              id={`saved-${goalId}`}
              name="savedMinor"
              type="number"
              inputMode="decimal"
              step="1"
              min="0"
              defaultValue={fromMinor(savedMinor)}
              className="tabular font-mono"
            />
          </div>
          <Button type="submit" variant="ghost" size="sm" disabled={pending}>
            {pending ? "…" : "Update"}
          </Button>
        </div>
      )}
    </ActionForm>
  );
}
