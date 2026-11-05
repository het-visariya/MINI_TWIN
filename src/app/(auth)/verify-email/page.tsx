import type { Metadata } from "next";
import Link from "next/link";

import { ResendVerification } from "@/components/auth/resend-verification";
import { Button } from "@/components/ui/button";

/*
 * Blocking rather than streamed: this route decides whether the visitor may
 * see the page at all. A redirect cannot be streamed inside a Suspense
 * fallback — the shell would paint first and the user would see a flash of an
 * app they are not logged into — so the session check runs before any HTML.
 */
export const instant = false;

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <h1 className="text-xl">Confirm your email</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">
        Your account exists, but it stays locked until you open the link we sent.
      </p>

      {error && (
        <p
          role="alert"
          className="border-attention/30 bg-attention/5 mt-5 rounded-lg border p-3 text-sm"
        >
          That link has expired or has already been used. Send yourself a fresh one.
        </p>
      )}

      <div className="mt-6">
        <ResendVerification />
      </div>

      <div className="text-muted-foreground mt-6 space-y-2 text-xs leading-relaxed">
        <p>
          Not in your inbox? It can take a minute, and it sometimes lands in spam or
          in Gmail&rsquo;s Promotions tab.
        </p>
      </div>

      <Button variant="ghost" className="mt-4 w-full" asChild>
        <Link href="/login">Back to log in</Link>
      </Button>
    </>
  );
}
