"use server";

/**
 * Finance mutations.
 *
 * Amounts arrive from the form as rupees and are converted to paise by the
 * schemas (`rupeesToMinor`) before anything else touches them, so no code
 * below this line handles a rupee float.
 */

import { revalidatePath } from "next/cache";

import { requireWriter } from "@/lib/auth/session";
import {
  demoFinanceRepo,
  financeRepoForUser,
  type FinanceRepo,
} from "@/lib/data/finance.repo";
import {
  expenseSchema,
  financeProfileSchema,
  investmentSchema,
  savingsGoalSchema,
  subscriptionSchema,
  updateSavingsSchema,
} from "@/lib/validation/finance";
import { formDataToObject, invalid, type ActionResult } from "@/lib/validation/shared";

async function resolve(): Promise<FinanceRepo> {
  const writer = await requireWriter();
  return writer.kind === "demo" ? demoFinanceRepo : financeRepoForUser(writer.userId);
}

function done() {
  revalidatePath("/finance");
}

/** Deletes share one shape: read an id, call the repo, revalidate. */
function deleteAction(
  field: string,
  call: (repo: FinanceRepo, id: string) => Promise<void>,
  missing: string,
) {
  return async function remove(formData: FormData): Promise<ActionResult> {
    try {
      const repo = await resolve();

      const id = String(formData.get(field) ?? "").trim();
      if (!id) return { ok: false, error: missing };

      await call(repo, id);
      done();

      return { ok: true, data: undefined };
    } catch (error) {
      return failure(error);
    }
  };
}

/* -------------------------------------------------------------------------- */
/*                                  profile                                   */
/* -------------------------------------------------------------------------- */

export async function saveFinanceProfile(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const parsed = financeProfileSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.saveProfile(parsed.data);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/*                                  expenses                                  */
/* -------------------------------------------------------------------------- */

export async function addExpense(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const repo = await resolve();

    const parsed = expenseSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const expense = await repo.addExpense(parsed.data);
    done();

    return { ok: true, data: expense };
  } catch (error) {
    return failure(error);
  }
}

export const deleteExpense = deleteAction(
  "expenseId",
  (repo, id) => repo.deleteExpense(id),
  "That expense could not be found.",
);

/* -------------------------------------------------------------------------- */
/*                               subscriptions                                */
/* -------------------------------------------------------------------------- */

export async function addSubscription(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const parsed = subscriptionSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.addSubscription(parsed.data);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export const deleteSubscription = deleteAction(
  "subscriptionId",
  (repo, id) => repo.deleteSubscription(id),
  "That subscription could not be found.",
);

/* -------------------------------------------------------------------------- */
/*                                  savings                                   */
/* -------------------------------------------------------------------------- */

export async function addSavingsGoal(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const parsed = savingsGoalSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.addSavingsGoal(parsed.data);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function updateSavings(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const parsed = updateSavingsSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.updateSavings(parsed.data.goalId, parsed.data.savedMinor);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export const deleteSavingsGoal = deleteAction(
  "goalId",
  (repo, id) => repo.deleteSavingsGoal(id),
  "That goal could not be found.",
);

/* -------------------------------------------------------------------------- */
/*                                investments                                 */
/* -------------------------------------------------------------------------- */

export async function addInvestment(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const parsed = investmentSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.addInvestment(parsed.data);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export const deleteInvestment = deleteAction(
  "investmentId",
  (repo, id) => repo.deleteInvestment(id),
  "That holding could not be found.",
);

/* -------------------------------------------------------------------------- */
/*                                  failures                                  */
/* -------------------------------------------------------------------------- */

function failure(error: unknown): ActionResult<never> {
  const message = error instanceof Error ? error.message : "unknown error";

  if (message === "Not signed in.") {
    return { ok: false, error: "Your session has expired. Sign in again to save this." };
  }

  console.error(`[finance action] ${message}`);

  return {
    ok: false,
    error: "That did not save. Nothing was changed — try again in a moment.",
  };
}
