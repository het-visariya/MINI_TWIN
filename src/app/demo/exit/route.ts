import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DEMO_COOKIE, signedCookieOptions } from "@/lib/auth/signed-cookie";

/** Leaves the demo. Nothing to clean up — the demo never wrote anything. */
export async function GET() {
  const store = await cookies();
  store.set(DEMO_COOKIE, "", { ...signedCookieOptions, maxAge: 0 });

  redirect("/");
}
