/**
 * Writes one PulseSnapshot per user per day, and this week's stored review.
 *
 * Idempotent: the `[userId, date]` unique index means running it twice updates
 * the row rather than adding a second one, so a retrying scheduler cannot
 * corrupt a trend.
 */

import { authoriseCron } from "@/lib/cron";
import {
  recordSnapshotsForAllUsers,
  recordWeeklyReview,
  syncAchievements,
} from "@/lib/data/insights.repo";
import { getPrisma, hasDatabase } from "@/lib/db";

export async function POST(request: Request) {
  const auth = authoriseCron(request);
  if (!auth.ok) return auth.response;

  if (!hasDatabase()) {
    return Response.json({ error: "No database configured." }, { status: 503 });
  }

  const now = new Date();

  try {
    const written = await recordSnapshotsForAllUsers(now);

    /* The review and the achievements both read the snapshot that was just
       written, so they run after it rather than alongside. */
    const users = await getPrisma().user.findMany({ select: { id: true } });
    for (const user of users) {
      await recordWeeklyReview(user.id, now);
      await syncAchievements(user.id, now);
    }

    return Response.json({ ok: true, snapshots: written, at: now.toISOString() });
  } catch (error) {
    /* Logged with detail, answered without it: this endpoint is reachable by
       anyone holding the secret, and a stack trace is not theirs to read. */
    console.error(
      `[cron/snapshot] ${error instanceof Error ? error.message : "unknown error"}`,
    );

    return Response.json({ error: "The snapshot run failed." }, { status: 500 });
  }
}
