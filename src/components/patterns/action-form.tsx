"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/validation/shared";

/**
 * A form wired to a server action, with the four states every form needs.
 *
 * Declared once because the alternative is each of the forty-odd forms in this
 * product deciding for itself what to do while saving and what to do when the
 * server says no — and the answers would diverge.
 *
 *   - pending: the submit button is disabled and says so
 *   - field errors: rendered inline, next to the field, via `FieldError`
 *   - a server error: one toast, with the form's values left intact so
 *     nothing the user typed is lost
 *   - success: an optional toast, and the form resets if asked to
 *
 * `children` is a render prop rather than plain nodes so a field can read the
 * pending flag and its own error without a context provider.
 */
export function ActionForm<T>({
  action,
  children,
  successMessage,
  resetOnSuccess = false,
  onSuccess,
  className,
  ...rest
}: {
  action: (formData: FormData) => Promise<ActionResult<T>>;
  children: (state: {
    pending: boolean;
    fieldErrors: Record<string, string>;
    result: ActionResult<T> | null;
  }) => React.ReactNode;
  successMessage?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (data: T) => void;
  className?: string;
} & Omit<React.ComponentProps<"form">, "action" | "children" | "className">) {
  const form = useRef<HTMLFormElement>(null);

  const [result, submit, pending] = useActionState<ActionResult<T> | null, FormData>(
    async (_previous, formData) => action(formData),
    null,
  );

  /*
   * The callback is held in a ref, and the effect depends on `result` alone.
   *
   * This is not a tidying-up. With `onSuccess` in the dependency array the
   * form looped forever on every successful save:
   *
   *   save succeeds -> effect runs -> onSuccess() sets state in the caller
   *   -> caller re-renders -> its inline arrow has a new identity
   *   -> the dependency changed, so the effect runs AGAIN -> toast, setState,
   *      re-render, ...
   *
   * Every caller passes an inline function, which is the ordinary way to
   * write one, so the bug was in this file rather than in any of them. The
   * visible symptom was a toast storm that exhausted React's nested-update
   * limit and surfaced as "Maximum update depth exceeded" inside sonner —
   * naming a component that had nothing to do with the cause.
   *
   * `result` is the honest trigger: one new result object per submission.
   * Submitting twice with the same outcome still produces a new object, so
   * the second toast fires, which a success boolean would have swallowed.
   */
  const latest = useRef({ successMessage, resetOnSuccess, onSuccess });

  /* Declared before the effect that reads it. Effects run in declaration
     order, so on the render where `result` changes this one has already
     refreshed the ref. Writing it during render instead would be a mutation
     in the render phase, which React's compiler rejects. */
  useEffect(() => {
    latest.current = { successMessage, resetOnSuccess, onSuccess };
  });

  useEffect(() => {
    if (!result) return;

    const { successMessage: message, resetOnSuccess: reset, onSuccess: done } =
      latest.current;

    if (result.ok) {
      if (message) toast.success(message);
      if (reset) form.current?.reset();
      done?.(result.data);
      return;
    }

    /* Field errors are already shown next to the fields. A toast as well
       would say the same thing twice. */
    if (!result.fieldErrors) toast.error(result.error);
  }, [result]);

  return (
    <form ref={form} action={submit} className={className} {...rest}>
      {children({
        pending,
        fieldErrors: (result && !result.ok ? result.fieldErrors : undefined) ?? {},
        result,
      })}
    </form>
  );
}

/**
 * One field's validation message.
 *
 * `role="alert"` so it is announced when it appears, and tied to the input by
 * id from the caller — a red sentence a screen reader never reads is not an
 * error message.
 */
export function FieldError({
  id,
  message,
  className,
}: {
  id?: string;
  message?: string;
  className?: string;
}) {
  if (!message) return null;

  return (
    <p id={id} role="alert" className={cn("text-risk mt-1 text-xs", className)}>
      {message}
    </p>
  );
}

/**
 * The form-level error, for failures that belong to no single field.
 *
 * Rendered as well as the toast, because a toast disappears and a user who
 * looked away needs the reason to still be on screen.
 */
export function FormError({ result }: { result: ActionResult<unknown> | null }) {
  if (!result || result.ok || result.fieldErrors) return null;

  return (
    <p
      role="alert"
      className="text-risk border-risk/30 bg-risk/5 rounded-lg border px-3 py-2 text-xs"
    >
      {result.error}
    </p>
  );
}
