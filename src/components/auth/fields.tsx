"use client";

import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "cn";

/** One error line, announced to screen readers as it appears. */
export function FieldError({ children }: { children?: string }) {
  if (!children) return null;

  return (
    <p className="text-risk mt-1.5 flex items-start gap-1.5 text-xs">
      <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

/** Form-level failure. `role="alert"` so a rejected login is heard, not just seen. */
export function FormError({ children }: { children?: string }) {
  if (!children) return null;

  return (
    <p
      role="alert"
      className="border-risk/30 bg-risk/5 text-risk mb-4 flex items-start gap-2 rounded-lg border p-3 text-sm"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="text-foreground">{children}</span>
    </p>
  );
}

export function TextField({
  label,
  error,
  hint,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="mt-1.5"
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(hint && hintId, error && errorId) || undefined}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-muted-foreground mt-1.5 text-xs">
          {hint}
        </p>
      )}
      <span id={errorId}>
        <FieldError>{error}</FieldError>
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const STRENGTH_LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"] as const;

/**
 * Length first, then variety.
 *
 * Deliberately not a character-class checklist: "Password1!" satisfies every
 * such rule and is weak, while a four-word phrase breaks all of them and is
 * strong. Length carries most of the score, and the meter never blocks
 * submission — the 10-character minimum does that, server-side.
 */
export function scorePassword(value: string): number {
  if (value.length < 10) return 0;

  let score = 1;
  if (value.length >= 14) score += 1;
  if (value.length >= 20) score += 1;

  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((pattern) =>
    pattern.test(value),
  ).length;
  if (variety >= 3) score += 1;

  /* A single repeated character or an obvious sequence is not length. */
  if (/^(.)\1+$/.test(value) || /12345|qwerty|password/i.test(value)) score = 1;

  return Math.min(4, score);
}

export function PasswordField({
  label,
  error,
  showStrength = false,
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type"> & {
  label: string;
  error?: string;
  showStrength?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const score = showStrength ? scorePassword(String(value ?? "")) : 0;
  const text = String(value ?? "");

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>

      <div className="relative mt-1.5">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          className="pr-11"
          aria-invalid={error ? true : undefined}
          aria-describedby={showStrength ? `${id}-strength` : undefined}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute top-1/2 right-1.5 -translate-y-1/2"
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      </div>

      {showStrength && (
        <div id={`${id}-strength`} className="mt-2">
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((segment) => (
              <span
                key={segment}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  text.length > 0 && segment < score ? "bg-accent" : "bg-surface-2",
                )}
              />
            ))}
          </div>
          <p className="text-muted-foreground mt-1.5 text-xs">
            {text.length === 0
              ? "At least 10 characters. A short phrase is easier to remember and harder to guess."
              : STRENGTH_LABELS[score]}
          </p>
        </div>
      )}

      <FieldError>{error}</FieldError>
    </div>
  );
}
