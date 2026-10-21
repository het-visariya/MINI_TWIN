/**
 * Shared guard for the cron endpoints.
 *
 * These routes write for every user in the database, so they are the most
 * powerful unauthenticated surface in the app. The rules:
 *
 *  - A missing or wrong `Authorization: Bearer ${CRON_SECRET}` gets 401, with
 *    no hint about which half was wrong.
 *  - An unset `CRON_SECRET` means the endpoint is **closed**, not open. A
 *    deployment that forgot the variable must not expose a write-everything
 *    endpoint to the internet.
 *  - The comparison is length-safe and constant-time, so the response time
 *    does not leak how much of the secret was right.
 */

import { timingSafeEqual } from "node:crypto";

export type CronAuth = { ok: true } | { ok: false; response: Response };

export function authoriseCron(request: Request): CronAuth {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return {
      ok: false,
      response: Response.json(
        { error: "Cron is not configured on this deployment." },
        { status: 503 },
      ),
    };
  }

  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";

  if (!header.startsWith(prefix) || !safeEqual(header.slice(prefix.length), secret)) {
    return {
      ok: false,
      response: Response.json({ error: "Unauthorised." }, { status: 401 }),
    };
  }

  return { ok: true };
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  /* timingSafeEqual throws on a length mismatch, which would itself be a
     timing signal. Compared against a same-length buffer first so the answer
     is always false rather than an exception. */
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }

  return timingSafeEqual(left, right);
}
