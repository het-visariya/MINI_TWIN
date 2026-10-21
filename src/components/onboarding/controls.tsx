"use client";

import { useId, useState } from "react";

import { FieldError } from "@/components/auth/fields";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * The four controls the wizard needs, so each step is a list of questions
 * rather than a list of div soup. All of them post plain form fields — the
 * wizard submits a FormData and the server action validates it, so nothing
 * depends on client state being correct.
 */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      {hint && (
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{hint}</p>
      )}
      <div className="mt-2">{children}</div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

/**
 * A radio group styled as cards. Radios rather than a select because the
 * options carry an example each, and the example is the point — "Direct" means
 * nothing until you see what Direct sounds like.
 */
export function Choice({
  name,
  label,
  hint,
  options,
  defaultValue,
  error,
}: {
  name: string;
  label?: string;
  hint?: string;
  options: { value: string; label: string; hint?: string }[];
  defaultValue?: string;
  error?: string;
}) {
  const groupId = useId();

  return (
    <fieldset>
      {label && (
        <legend className="text-sm font-medium">
          {label}
          {hint && (
            <span className="text-muted-foreground mt-0.5 block text-xs font-normal leading-relaxed">
              {hint}
            </span>
          )}
        </legend>
      )}

      <div className={cn("grid gap-2", label && "mt-2")}>
        {options.map((option) => {
          const id = `${groupId}-${option.value}`;

          return (
            <div key={option.value}>
              <input
                type="radio"
                id={id}
                name={name}
                value={option.value}
                defaultChecked={option.value === defaultValue}
                className="peer sr-only"
              />
              <label
                htmlFor={id}
                className="hover:bg-surface-2 peer-checked:border-accent/50 peer-checked:bg-accent/5 peer-focus-visible:outline-ring flex min-h-11 cursor-pointer flex-col justify-center rounded-lg border px-3.5 py-2.5 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
              >
                <span className="text-sm font-medium">{option.label}</span>
                {option.hint && (
                  <span className="text-muted-foreground mt-0.5 text-xs">
                    {option.hint}
                  </span>
                )}
              </label>
            </div>
          );
        })}
      </div>

      <FieldError>{error}</FieldError>
    </fieldset>
  );
}

export function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  const id = useId();
  const [on, setOn] = useState(Boolean(defaultChecked));

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        {hint && (
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{hint}</p>
        )}
      </div>

      {/* Radix's Switch renders a button, not an input. Rather than depend on
          its hidden-field behaviour, the value is mirrored into a checkbox we
          own — so what the server action receives is never in doubt. */}
      <input type="checkbox" name={name} checked={on} readOnly hidden />
      <Switch
        id={id}
        checked={on}
        onCheckedChange={setOn}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}
