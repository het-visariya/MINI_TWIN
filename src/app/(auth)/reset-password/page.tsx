import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Button } from "@/components/ui/button";

/*
 * Blocking rather than streamed: this route decides whether the visitor may
 * see the page at all. A redirect cannot be streamed inside a Suspense
 * fallback — the shell would paint first and the user would see a flash of an
 * app they are not logged into — so the session check runs before any HTML.
 */
export const instant = false;

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token || error) {
    return (
      <>
        <h1 className="text-xl">That link has expired</h1>
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
          Reset links last an hour and can only be used once. Your password has not
          been changed — ask for a new link and you can set it then.
        </p>

        <Button className="mt-6 w-full" asChild>
          <Link href="/forgot-password">Send a new link</Link>
        </Button>
        <Button variant="ghost" className="mt-3 w-full" asChild>
          <Link href="/login">Back to log in</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <h1 className="text-xl">Set a new password</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">
        Choose something you can remember. You will be logged out everywhere else.
      </p>

      <div className="mt-6">
        <ResetPasswordForm token={token} />
      </div>
    </>
  );
}
