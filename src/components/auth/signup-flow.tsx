"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FormError, PasswordField, TextField } from "@/components/auth/fields";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { checkAge } from "@/lib/auth/age";
import { createAccount, verifyAge } from "@/lib/auth/actions";

/**
 * Signup in the order the spec sets: date of birth, then credentials.
 *
 * The gate is not a formality to get past — under-13 and 13–17 both end the
 * flow here, and no account is created in either case. The copy for each is
 * written to be kind rather than to look like an error, because being turned
 * away by software usually reads as being told off.
 */
type Stage =
  | { name: "dob" }
  | { name: "blocked-child" }
  | { name: "blocked-minor" }
  | { name: "credentials" }
  | { name: "sent"; email: string };

export function SignUpFlow({
  googleEnabled,
  alreadyPassed,
}: {
  googleEnabled: boolean;
  alreadyPassed: boolean;
}) {
  const [stage, setStage] = useState<Stage>(
    alreadyPassed ? { name: "credentials" } : { name: "dob" },
  );

  switch (stage.name) {
    case "dob":
      return <DobStep onResolved={setStage} />;
    case "blocked-child":
      return <BlockedChild />;
    case "blocked-minor":
      return <BlockedMinor />;
    case "credentials":
      return (
        <CredentialsStep
          googleEnabled={googleEnabled}
          onBack={() => setStage({ name: "dob" })}
          onSent={(email) => setStage({ name: "sent", email })}
        />
      );
    case "sent":
      return <CheckYourInbox email={stage.email} />;
  }
}

/* ---------------------------------- gate ---------------------------------- */

function DobStep({ onResolved }: { onResolved: (stage: Stage) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  /* Checked as you type for immediate feedback; the server action decides. */
  const preview = value ? checkAge(value) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setPending(true);

    const { verdict } = await verifyAge(value);
    setPending(false);

    switch (verdict.outcome) {
      case "allowed":
        onResolved({ name: "credentials" });
        return;
      case "blocked-child":
        onResolved({ name: "blocked-child" });
        return;
      case "blocked-minor":
        onResolved({ name: "blocked-minor" });
        return;
      case "invalid":
        setError(verdict.reason);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <FormError>{error}</FormError>

      <TextField
        label="Date of birth"
        type="date"
        name="dob"
        required
        max={new Date().toISOString().slice(0, 10)}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        hint="Your twin uses this to keep its suggestions appropriate — for example, it never sets weight targets for under-20s."
        error={preview?.outcome === "invalid" ? preview.reason : undefined}
      />

      <Button
        type="submit"
        size="lg"
        className="mt-6 w-full"
        disabled={pending || !value}
      >
        {pending ? "Checking…" : "Continue"}
        <ArrowRight aria-hidden />
      </Button>
    </form>
  );
}

function BlockedChild() {
  return (
    <div className="space-y-4">
      <div className="bg-surface-2/60 rounded-xl border border-dashed p-5">
        <p className="text-sm font-medium">
          Digital Twin is not built for your age group yet
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          You need to be 13 or older to have an account here, so we have not created
          one and have not kept anything you typed.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Nothing is wrong with you asking — this is a rule about us, not about you.
          Come back when you are older, and the twin will be waiting.
        </p>
      </div>

      <Button variant="outline" className="w-full" asChild>
        <Link href="/">
          <ArrowLeft aria-hidden />
          Back to the homepage
        </Link>
      </Button>
    </div>
  );
}

function BlockedMinor() {
  return (
    <div className="space-y-4">
      <div className="bg-surface-2/60 rounded-xl border border-dashed p-5">
        <p className="text-sm font-medium">
          Accounts for under-18s open once parental consent is in place
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Digital Twin holds academic, health and money information, so for anyone
          under 18 we need a parent or guardian in the loop before an account can
          exist. That consent flow is not built yet, so no account has been created
          and nothing you typed has been kept.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          You can still see exactly how the product works with sample data.
        </p>
      </div>

      <Button className="w-full" asChild>
        <Link href="/demo">Try the demo instead</Link>
      </Button>
      <Button variant="ghost" className="w-full" asChild>
        <Link href="/">
          <ArrowLeft aria-hidden />
          Back to the homepage
        </Link>
      </Button>
    </div>
  );
}

/* ------------------------------- credentials ------------------------------ */

function CredentialsStep({
  googleEnabled,
  onBack,
  onSent,
}: {
  googleEnabled: boolean;
  onBack: () => void;
  onSent: (email: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setPending(true);

    const result = await createAccount({ name, email, password });
    setPending(false);

    if (result.ok) {
      onSent(result.email);
      return;
    }

    setErrors({ [result.field ?? "_"]: result.error });
  }

  return (
    <form onSubmit={submit} noValidate>
      <FormError>{errors._ ?? errors.dob}</FormError>

      <div className="space-y-4">
        <TextField
          label="Your name"
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
        />

        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />

        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          required
          showStrength
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
      </div>

      <Button type="submit" size="lg" className="mt-6 w-full" disabled={pending}>
        {pending ? "Creating your twin…" : "Create my twin"}
      </Button>

      {googleEnabled && (
        <>
          <AuthDivider />
          <GoogleButton next="/onboarding/about-you" label="Sign up with Google" />
        </>
      )}

      <Button type="button" variant="ghost" className="mt-4 w-full" onClick={onBack}>
        <ArrowLeft aria-hidden />
        Change date of birth
      </Button>

      <p className="text-muted-foreground mt-5 text-xs leading-relaxed">
        Your data is yours. You can export or delete all of it at any time, and the
        twin asks before sending anything to an AI model.
      </p>
    </form>
  );
}

function CheckYourInbox({ email }: { email: string }) {
  return (
    <div className="space-y-4">
      <div className="border-accent/25 bg-accent/5 rounded-xl border p-5">
        <p className="text-sm font-medium">Confirm your email to continue</p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          We sent a link to <span className="text-foreground">{email}</span>. Open it
          and your twin is ready to set up. The link lasts an hour.
        </p>
      </div>

      <Button variant="outline" className="w-full" asChild>
        <Link href="/verify-email">I did not get the email</Link>
      </Button>
    </div>
  );
}
