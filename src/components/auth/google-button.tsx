"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth/client";

/**
 * Google sign-in.
 *
 * `disabled` is how the age gate reaches OAuth: Google hands back an email, a
 * name and a picture, never a date of birth, so the button stays unavailable
 * until the gate has been passed in this browser. Without that, Google would
 * be a way around the gate.
 */
export function GoogleButton({
  disabled,
  disabledReason,
  next = "/home",
  label = "Continue with Google",
}: {
  disabled?: boolean;
  disabledReason?: string;
  next?: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={disabled || pending}
        onClick={async () => {
          setPending(true);
          try {
            await signIn.social({ provider: "google", callbackURL: next });
          } finally {
            setPending(false);
          }
        }}
      >
        <GoogleMark />
        {pending ? "Opening Google…" : label}
      </Button>

      {disabled && disabledReason && (
        <p className="text-muted-foreground mt-1.5 text-xs">{disabledReason}</p>
      )}
    </div>
  );
}

/** Google's mark, at its official colours — the one place brand colour is allowed. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H1.04v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.96H1.04a9 9 0 0 0 0 8.08l2.93-2.32Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 1.04 4.96l2.93 2.32C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="bg-border h-px flex-1" />
      <span className="text-muted-foreground text-xs">or</span>
      <span className="bg-border h-px flex-1" />
    </div>
  );
}
