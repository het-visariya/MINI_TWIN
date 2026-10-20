import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  DEMO_COOKIE,
  DEMO_COOKIE_MAX_AGE,
  sign,
  signedCookieOptions,
} from "@/lib/auth/signed-cookie";

/**
 * "Try the demo" on the landing page.
 *
 * Sets a signed, httpOnly cookie and nothing else. Demo mode is resolved from
 * that cookie in `getRepo()`, which hands back the fixture implementation —
 * so a demo visitor never gets a Prisma client at all, and no amount of
 * clicking in the demo can reach a real row. `requireUser`, which every write
 * action calls, rejects demo outright.
 */
export async function GET() {
  const store = await cookies();

  store.set(DEMO_COOKIE, sign("1"), {
    ...signedCookieOptions,
    maxAge: DEMO_COOKIE_MAX_AGE,
  });

  redirect("/home");
}
