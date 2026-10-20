import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Forgot your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl">Forgot your password</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">
        Tell us your email address and we will send a link to set a new one.
      </p>

      <div className="mt-6">
        <ForgotPasswordForm />
      </div>

      <Button variant="ghost" className="mt-6 w-full" asChild>
        <Link href="/login">Back to log in</Link>
      </Button>
    </>
  );
}
