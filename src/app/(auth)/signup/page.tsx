import type { Metadata } from "next";
import Link from "next/link";

import { SignUpFlow } from "@/components/auth/signup-flow";
import { googleEnabled } from "@/lib/auth/auth";
import { hasPassedAgeGate } from "@/lib/auth/actions";

/*
 * Blocking rather than streamed: this route decides whether the visitor may
 * see the page at all. A redirect cannot be streamed inside a Suspense
 * fallback — the shell would paint first and the user would see a flash of an
 * app they are not logged into — so the session check runs before any HTML.
 */
export const instant = false;

export const metadata: Metadata = { title: "Create your twin" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ resume?: string }>;
}) {
  const { resume } = await searchParams;

  return (
    <>
      <h1 className="text-xl">Create your twin</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">
        Two steps. Your date of birth first, because it changes what your twin is
        allowed to suggest.
      </p>

      {resume === "1" && (
        <p
          role="alert"
          className="border-attention/30 bg-attention/5 mt-5 rounded-lg border p-3 text-sm"
        >
          We still need your date of birth before your twin can be set up.
        </p>
      )}

      <div className="mt-6">
        <SignUpFlow
          googleEnabled={googleEnabled()}
          alreadyPassed={await hasPassedAgeGate()}
        />
      </div>

      <p className="text-muted-foreground mt-6 text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </>
  );
}
