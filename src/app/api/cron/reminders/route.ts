/**
 * Evaluates due reminders for every user and delivers them.
 *
 * The guardrails live in the repo's delivery run, not here: quiet hours and
 * the daily cap are checked before anything is written, and the cap is
 * re-checked per notification so a run that starts with one slot left cannot
 * post five.
 */

import { authoriseCron } from "@/lib/cron";
import { deliverRemindersForAllUsers } from "@/lib/data/reminders.repo";
import { hasDatabase } from "@/lib/db";

export async function POST(request: Request) {
  const auth = authoriseCron(request);
  if (!auth.ok) return auth.response;

  if (!hasDatabase()) {
    return Response.json({ error: "No database configured." }, { status: 503 });
  }

  const now = new Date();

  try {
    const result = await deliverRemindersForAllUsers(now);

    return Response.json({
      ok: true,
      users: result.users,
      sent: result.sent,
      at: now.toISOString(),
    });
  } catch (error) {
    console.error(
      `[cron/reminders] ${error instanceof Error ? error.message : "unknown error"}`,
    );

    return Response.json({ error: "The reminder run failed." }, { status: 500 });
  }
}
