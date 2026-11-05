"use client";

import { useState } from "react";

import { TextField } from "@/components/auth/fields";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  if (sent) {
    return (
      <p className="border-ok/30 bg-ok/5 rounded-lg border p-3 text-sm leading-relaxed">
        If that address has an account, a reset link is on its way. It lasts an hour.
        <span className="text-muted-foreground mt-2 block text-xs">
          Nothing about your account has changed yet — the link is what changes your
          password.
        </span>
      </p>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    /*
     * Always the same confirmation, whether or not the address has an account.
     * A form that says "no account with that email" is a way to enumerate who
     * has signed up.
     */
    await authClient
      .requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: "/reset-password",
      })
      .catch(() => undefined);

    setPending(false);
    setSent(true);
  }

  return (
    <form onSubmit={submit} noValidate>
      <TextField
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <Button type="submit" size="lg" className="mt-5 w-full" disabled={pending || !email}>
        {pending ? "Sending…" : "Send the reset link"}
      </Button>
    </form>
  );
}
