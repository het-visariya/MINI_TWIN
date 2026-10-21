/**
 * Writes one PulseSnapshot per user per day, plus this week's stored review
 * and any milestones the new data unlocks.
 *
 * Idempotent: the `[userId, date]` unique index means running it twice updates
 * the row rather than adding a second one, so a retrying scheduler cannot
 * corrupt a trend.
 *
 * The route orchestrates and nothing more — the queries live in the repo.
 */

import { authoriseCron } from "@/lib/cron";
import { runDailySnapshotForAllUsers } from "@/lib/data/insights.repo";
import { hasDatabase } from "@/lib/db";

export async function POST(request: Request) {
  const auth = authoriseCron(request);
  if (!auth.ok) return auth.response;

  if (!hasDatabase()) {
    return Response.json({ error: "No database configured." }, { status: 503 });
  }

  const now = new Date();

  try {
    const result = await runDailySnapshotForAllUsers(now);

    return Response.json({
      ok: true,
      users: result.users,
      snapshots: result.snapshots,
      at: now.toISOString(),
    });
  } catch (error) {
    /* Logged with detail, answered without it: this endpoint is reachable by
       anyone holding the secret, and a stack trace is not theirs to read. */
    console.error(
      `[cron/snapshot] ${error instanceof Error ? error.message : "unknown error"}`,
    );

    return Response.json({ error: "The snapshot run failed." }, { status: 500 });
  }
}
