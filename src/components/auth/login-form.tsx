"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormError, PasswordField, TextField } from "@/components/auth/fields";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth/client";

export function LoginForm({
  next,
  googleEnabled,
}: {
  next: string;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [needsVerification, setNeedsVerification] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setNeedsVerification(false);
    setPending(true);

    const { error: failure } = await signIn.email({
      email: email.trim().toLowerCase(),
      password,
      callbackURL: next,
    });

    setPending(false);

    if (!failure) {
      router.push(next);
      return;
    }

    /*
     * One message for every credential failure, on purpose: saying "no account
     * with that email" would turn this form into a way to find out who has an
     * account here. An unverified address is the one exception, because the
     * user needs to know to go and check their inbox.
     */
    if (/verif/i.test(failure.message ?? "")) {
      setNeedsVerification(true);
      return;
    }

    setError("That email and password do not match an account.");
  }

  return (
    <form onSubmit={submit} noValidate>
      <FormError>{error}</FormError>

      {needsVerification && (
        <p
          role="alert"
          className="border-attention/30 bg-attention/5 mb-4 rounded-lg border p-3 text-sm"
        >
          Confirm your email address first — check your inbox for the link.{" "}
          <Link
            href="/verify-email"
            className="text-foreground underline underline-offset-4"
          >
            Send it again
          </Link>
        </p>
      )}

      <div className="space-y-4">
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <div>
          <PasswordField
            label="Password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Link
            href="/forgot-password"
            className="text-muted-foreground mt-2 inline-block text-xs underline underline-offset-4"
          >
            Forgot your password?
          </Link>
        </div>
      </div>

      <Button type="submit" size="lg" className="mt-6 w-full" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </Button>

      {googleEnabled && (
        <>
          <AuthDivider />
          <GoogleButton next={next} label="Log in with Google" />
        </>
      )}
    </form>
  );
}
