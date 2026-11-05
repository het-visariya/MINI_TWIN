import { getAuth } from "@/lib/auth/auth";

/**
 * Better Auth's endpoints: sign-in, sign-up, OAuth callbacks, email
 * verification, password reset, sign-out.
 *
 * Written as explicit handlers rather than `toNextJsHandler(auth)` so the auth
 * instance — and with it the database connection — is built on the first
 * request instead of when this module is evaluated at build time.
 */

export async function GET(request: Request) {
  return getAuth().handler(request);
}

export async function POST(request: Request) {
  return getAuth().handler(request);
}
