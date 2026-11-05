import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next 16's proxy (previously middleware).
 *
 * This is a redirect for the common case, not the security boundary. It only
 * checks whether a session cookie is present — it does not verify it, because
 * doing so would mean a database round trip on every navigation. The real
 * check is `requireViewer`/`requireUser` in src/lib/auth/session.ts, which
 * every protected layout, server action and route handler calls.
 *
 * So: a forged cookie gets past this file and is then rejected by the layout.
 * A missing cookie is bounced here, which is what keeps `/home` from flashing
 * before redirecting.
 */

const PROTECTED = ["/home", "/productivity", "/academic", "/goals", "/regreter", "/twin", "/insights", "/health", "/nutrition", "/finance", "/career", "/reminders", "/settings", "/plan", "/onboarding"];

/** Signed-in users have no reason to see these. */
const AUTH_ONLY = ["/login", "/signup", "/forgot-password", "/reset-password"];

const DEMO_COOKIE = "dt_demo";

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const isAuthPage = AUTH_ONLY.some((route) => pathname === route);

  if (!isProtected && !isAuthPage) return NextResponse.next();

  const hasSession = Boolean(getSessionCookie(request));
  /* Presence only — the signature is verified server-side before any fixture
     is served, so a hand-written demo cookie buys nothing but a redirect. */
  const hasDemo = request.cookies.has(DEMO_COOKIE);

  if (isProtected && !hasSession && !hasDemo) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (isAuthPage && hasSession) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return NextResponse.next();
}

export const config = {
  /* Everything except Next's internals, the auth endpoints themselves and
     static files — matching those would break the OAuth callback. */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
