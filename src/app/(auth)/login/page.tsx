import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import { googleEnabled } from "@/lib/auth/auth";

/*
 * Blocking rather than streamed: this route decides whether the visitor may
 * see the page at all. A redirect cannot be streamed inside a Suspense
 * fallback — the shell would paint first and the user would see a flash of an
 * app they are not logged into — so the session check runs before any HTML.
 */
export const instant = false;

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; verified?: string; reset?: string }>;
}) {
  const { next, verified, reset } = await searchParams;

  return (
    <>
      <h1 className="text-xl">Welcome back</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">
        Log in and your twin picks up where your day left off.
      </p>

      {verified === "1" && (
        <p className="border-ok/30 bg-ok/5 mt-5 rounded-lg border p-3 text-sm">
          Email confirmed. Log in to finish setting up your twin.
        </p>
      )}

      {reset === "1" && (
        <p className="border-ok/30 bg-ok/5 mt-5 rounded-lg border p-3 text-sm">
          Your password has been changed. Log in with the new one.
        </p>
      )}

      <div className="mt-6">
        <LoginForm next={next ?? "/home"} googleEnabled={googleEnabled()} />
      </div>

      <p className="text-muted-foreground mt-6 text-sm">
        No account yet?{" "}
        <Link href="/signup" className="text-foreground underline underline-offset-4">
          Create your twin
        </Link>
      </p>
      <p className="text-muted-foreground mt-2 text-sm">
        Want to look around first?{" "}
        <Link href="/demo" className="text-foreground underline underline-offset-4">
          Try the demo
        </Link>
      </p>
    </>
  );
}
