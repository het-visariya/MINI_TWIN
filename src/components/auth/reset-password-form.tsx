"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormError, PasswordField, scorePassword } from "@/components/auth/fields";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;
  const tooShort = password.length > 0 && scorePassword(password) === 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);

    if (password !== confirm) {
      setError("Those two passwords are not the same.");
      return;
    }

    setPending(true);
    const { error: failure } = await authClient.resetPassword({
      token,
      newPassword: password,
    });
    setPending(false);

    if (failure) {
      setError(
        "That link has expired or has already been used. Ask for a new one and your password stays as it is.",
      );
      return;
    }

    router.push("/login?reset=1");
  }

  return (
    <form onSubmit={submit} noValidate>
      <FormError>{error}</FormError>

      <div className="space-y-4">
        <PasswordField
          label="New password"
          name="password"
          autoComplete="new-password"
          required
          showStrength
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={tooShort ? "Use at least 10 characters." : undefined}
        />

        <PasswordField
          label="New password again"
          name="confirm"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          error={mismatch ? "Those two passwords are not the same." : undefined}
        />
      </div>

      <Button
        type="submit"
        size="lg"
        className="mt-6 w-full"
        disabled={pending || tooShort || mismatch || !password}
      >
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
