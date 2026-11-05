/**
 * A fixed-window rate limit for our own endpoints.
 *
 * Reuses the `rate_limit` table Better Auth already owns, under namespaced
 * keys (`nutrition-analyze:<userId>`). That is deliberate: the alternative was
 * a second table with the same three columns and its own migration, and the
 * schemas would have drifted. Better Auth only ever reads keys it wrote, and
 * the namespace prefix keeps the two sets from colliding.
 *
 * Fixed window, not a sliding one. It is the cheaper, more predictable choice
 * for what this guards — a paid vision call, where the question is "has this
 * user had their dozen for the hour" rather than anything needing precision at
 * the boundary.
 */

import { getPrisma, hasDatabase } from "@/lib/db";

export type RateLimitVerdict = {
  ok: boolean;
  /** Requests left in the current window after this one. */
  remaining: number;
  /** Seconds until the window resets. Sent as Retry-After on a refusal. */
  retryAfterSeconds: number;
};

/**
 * Consume one unit against `key`.
 *
 * **Fails open.** If the limiter itself errors — the table is missing, the
 * database is briefly unreachable — the request is allowed. A rate limiter
 * that takes the feature down when it breaks has done more damage than the
 * abuse it exists to prevent, and this one guards cost, not correctness or
 * access.
 */
export async function consume(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitVerdict> {
  const allow = (remaining: number): RateLimitVerdict => ({
    ok: true,
    remaining,
    retryAfterSeconds: 0,
  });

  if (!hasDatabase()) return allow(limit - 1);

  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  try {
    const prisma = getPrisma();
    const existing = await prisma.rateLimit.findUnique({ where: { key } });

    /* First request, or the previous window has expired. `lastRequest` is
       BigInt in the schema Better Auth defined, hence the conversion. */
    if (!existing || now - Number(existing.lastRequest) >= windowMs) {
      await prisma.rateLimit.upsert({
        where: { key },
        create: { id: key, key, count: 1, lastRequest: BigInt(now) },
        update: { count: 1, lastRequest: BigInt(now) },
      });

      return allow(limit - 1);
    }

    const elapsed = now - Number(existing.lastRequest);
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));

    if (existing.count >= limit) {
      return { ok: false, remaining: 0, retryAfterSeconds };
    }

    await prisma.rateLimit.update({
      where: { key },
      /* `increment` rather than count + 1, so two requests racing cannot both
         read the same count and overwrite each other. */
      data: { count: { increment: 1 } },
    });

    return {
      ok: true,
      remaining: Math.max(0, limit - existing.count - 1),
      retryAfterSeconds,
    };
  } catch (error) {
    console.error(
      `[rate-limit] ${key} ${error instanceof Error ? error.message : "unknown error"}`,
    );

    return allow(limit - 1);
  }
}

/**
 * Photo analysis, per user.
 *
 * Twelve an hour is far above normal use — four meals plus retries — and far
 * below what would make a leaked session expensive.
 */
export const PHOTO_ANALYSIS_LIMIT = { limit: 12, windowSeconds: 60 * 60 } as const;

export function photoAnalysisKey(userId: string): string {
  return `nutrition-analyze:${userId}`;
}
