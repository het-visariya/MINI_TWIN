"use server";

/**
 * Reminder mutations.
 *
 * No action here composes a notification body. Every string comes from
 * `neutralCopy` inside the repo, so there is no path by which a caller can put
 * a weight, an amount or a subject name into something that appears on a lock
 * screen.
 */

import { revalidatePath } from "next/cache";

import { requireWriter } from "@/lib/auth/session";
import {
  demoRemindersRepo,
  remindersRepoForUser,
  type RemindersRepo,
} from "@/lib/data/reminders.repo";
import {
  notificationPrefsSchema,
  reminderRuleSchema,
  toggleRuleSchema,
} from "@/lib/validation/reminders";
import { formDataToObject, invalid, type ActionResult } from "@/lib/validation/shared";

async function resolve(): Promise<RemindersRepo> {
  const writer = await requireWriter();
  return writer.kind === "demo" ? demoRemindersRepo : remindersRepoForUser(writer.userId);
}

function done() {
  revalidatePath("/reminders");
  /* The header bell count comes from the same rows, so every layout that
     renders it is stale after any of these. */
  revalidatePath("/home");
}

export async function savePrefs(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const parsed = notificationPrefsSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.savePrefs(parsed.data);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function saveRule(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const parsed = reminderRuleSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.saveRule(parsed.data);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function toggleRule(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const parsed = toggleRuleSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    await repo.toggleRule(parsed.data.ruleId, parsed.data.enabled);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function markRead(formData: FormData): Promise<ActionResult> {
  try {
    const repo = await resolve();

    const notificationId = String(formData.get("notificationId") ?? "").trim();
    if (!notificationId) return { ok: false, error: "That notification could not be found." };

    await repo.markRead(notificationId);
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function markAllRead(): Promise<ActionResult> {
  try {
    const repo = await resolve();
    await repo.markAllRead();
    done();

    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Send a test reminder through the real gate.
 *
 * Returns the reason when it declines, because "nothing happened" is a worse
 * answer than "not now — you are inside your quiet hours". Demonstrating the
 * guardrail is more useful than bypassing it to prove delivery works.
 */
export async function sendTestReminder(): Promise<
  ActionResult<{ sent: boolean; reason?: string }>
> {
  try {
    const repo = await resolve();
    const result = await repo.sendTest(new Date());
    done();

    return { ok: true, data: result };
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown): ActionResult<never> {
  const message = error instanceof Error ? error.message : "unknown error";

  if (message === "Not signed in.") {
    return { ok: false, error: "Your session has expired. Sign in again to save this." };
  }

  console.error(`[reminders action] ${message}`);

  return {
    ok: false,
    error: "That did not save. Nothing was changed — try again in a moment.",
  };
}
