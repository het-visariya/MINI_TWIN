"use client";

import { useState } from "react";

import { TextField } from "@/components/auth/fields";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function ResendVerification() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  if (sent) {
    return (
      <p className="border-ok/30 bg-ok/5 rounded-lg border p-3 text-sm">
        If that address has an unconfirmed account, a new link is on its way. It
        lasts an hour.
      </p>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    /*
     * The outcome is not reported: whether the address exists, and whether it
     * is already verified, are both things this form must not reveal. The
     * endpoint is rate-limited server-side so it cannot be used to send mail
     * to someone repeatedly.
     */
    await authClient
      .sendVerificationEmail({
        email: email.trim().toLowerCase(),
        callbackURL: "/login?verified=1",
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
        {pending ? "Sending…" : "Send a new link"}
      </Button>
    </form>
  );
}
