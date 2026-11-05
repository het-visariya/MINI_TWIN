"use client";

import { Download, ShieldAlert, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ActionForm, FieldError, FormError } from "@/components/patterns/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { DELETE_PHRASE } from "@/lib/validation/settings";
import type { AccountView } from "@/lib/data/account.repo";
import type { ActionResult } from "@/lib/validation/shared";

const TONES = [
  { value: "GENTLE", label: "Gentle", hint: "Softest wording. Never blunt." },
  { value: "BALANCED", label: "Balanced", hint: "States the facts, plainly." },
  { value: "DIRECT", label: "Direct", hint: "Short and unvarnished." },
  { value: "NO_MERCY", label: "No mercy", hint: "Hardest setting. Still never insults you." },
];

export function PreferencesForm({
  action,
  profile,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  profile: AccountView["profile"];
}) {
  return (
    <ActionForm
      action={action}
      successMessage="Saved."
      className="bg-card shadow-card space-y-3 rounded-xl border p-4"
    >
      {({ pending, fieldErrors, result }) => (
        <>
          <div>
            <h2 className="text-base font-medium">You and your twin</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {profile.email} — your email address cannot be changed here.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="name" className="text-xs">
                What your twin calls you
              </Label>
              <Input id="name" name="name" defaultValue={profile.name} required />
              <FieldError message={fieldErrors.name} />
            </div>

            <div>
              <Label htmlFor="lifeStage" className="text-xs">
                Life stage
              </Label>
              <Select name="lifeStage" defaultValue={profile.lifeStage ?? "COLLEGE"}>
                <SelectTrigger id="lifeStage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCHOOL">School</SelectItem>
                  <SelectItem value="COLLEGE">College</SelectItem>
                  <SelectItem value="OTHER">Something else</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground mt-1 text-2xs">
                Changes which academic questions your twin asks.
              </p>
            </div>
          </div>

          <fieldset>
            <legend className="text-xs font-medium">Regreter tone</legend>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {TONES.map((tone) => (
                <label
                  key={tone.value}
                  className="bg-surface-2/50 flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5"
                >
                  <input
                    type="radio"
                    name="regreterTone"
                    value={tone.value}
                    defaultChecked={profile.regreterTone === tone.value}
                    className="accent-accent mt-0.5 size-4"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{tone.label}</span>
                    <span className="text-muted-foreground block text-xs">{tone.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <div>
              <p className="text-xs font-medium">Theme</p>
              <p className="text-muted-foreground text-2xs">
                Applies immediately and is remembered on this device.
              </p>
            </div>
            <ThemeToggle />
          </div>

          <FormError result={result} />

          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

/**
 * The Regreter's guardrails, read-only.
 *
 * Shown rather than hidden, and not editable, because they are promises the
 * product makes rather than settings. A user who could turn the cap off would
 * no longer have the guarantee.
 */
export function Guardrails() {
  return (
    <section className="bg-card shadow-card rounded-xl border p-4">
      <h2 className="text-base font-medium">Guardrails</h2>
      <p className="text-muted-foreground mt-0.5 text-xs">
        These are fixed. They are what the product promises, not preferences.
      </p>

      <ul className="mt-3 space-y-2">
        {[
          "At most three nudges a day, whatever the tone.",
          "A pause button that stops all nudges immediately.",
          "Gentle wording for a few days after any low-mood check-in.",
          "Never about food, weight or body shape. Ever.",
          "Compared only with your own past, never with other people.",
        ].map((rule) => (
          <li key={rule} className="flex gap-2 text-xs leading-relaxed">
            <span aria-hidden className="text-accent">
              ·
            </span>
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AiConsentForm({
  action,
  profile,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  profile: AccountView["profile"];
}) {
  return (
    <ActionForm
      action={action}
      successMessage="Saved."
      className="bg-card shadow-card space-y-3 rounded-xl border p-4"
    >
      {({ pending, result }) => (
        <>
          <div>
            <h2 className="text-base font-medium">What your twin may send to an AI</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Nothing is sent to a model unless you allow it here, and every request is
              written to the log below first.
            </p>
          </div>

          <div className="space-y-2">
            {[
              {
                name: "aiConsent",
                checked: profile.aiConsentAt !== null,
                label: "Allow Ask my twin to use an AI model",
                hint: "Turning this off makes your twin ask again before its next call.",
              },
              {
                name: "allowHealthDataToAi",
                checked: profile.allowHealthDataToAi,
                label: "Include health data",
                hint: "Workouts, sleep, weight and check-ins. Off by default.",
              },
              {
                name: "allowMoneyDataToAi",
                checked: profile.allowMoneyDataToAi,
                label: "Include money data",
                hint: "Spending, budget and holdings. Off by default.",
              },
            ].map((field) => (
              <label
                key={field.name}
                className="flex items-start gap-2.5 text-sm"
              >
                <input
                  type="checkbox"
                  name={field.name}
                  value="true"
                  defaultChecked={field.checked}
                  className="accent-accent mt-0.5 size-4"
                />
                <span className="min-w-0">
                  <span className="block font-medium">{field.label}</span>
                  <span className="text-muted-foreground block text-xs">{field.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <FormError result={result} />

          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

/** Export is a plain link: the browser downloads what the route returns. */
export function ExportButton() {
  return (
    <div className="bg-card shadow-card rounded-xl border p-4">
      <h2 className="text-base font-medium">Export everything</h2>
      <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
        One JSON file with every row we hold about you. Your password hash and session
        tokens are excluded — those are credentials, not data about you.
      </p>

      <Button variant="outline" size="sm" asChild>
        <a href="/api/account/export" download>
          <Download aria-hidden />
          Download my data
        </a>
      </Button>
    </div>
  );
}

export function SessionsPanel({
  action,
  sessions,
}: {
  action: () => Promise<ActionResult>;
  sessions: AccountView["sessions"];
}) {
  const [pending, startTransition] = useTransition();

  const signOutOthers = () =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success("Other devices signed out.");
      else toast.error(result.error);
    });

  const others = sessions.filter((session) => !session.current).length;

  return (
    <section className="bg-card shadow-card rounded-xl border p-4">
      <h2 className="text-base font-medium">Where you are signed in</h2>
      <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
        {sessions.length} active session{sessions.length === 1 ? "" : "s"}.
      </p>

      <ul className="space-y-2">
        {sessions.map((session) => (
          <li key={session.id} className="text-xs">
            <p className="font-medium">
              {session.userAgent ? shorten(session.userAgent) : "Unknown device"}
              {session.current && (
                <span className="text-accent font-normal"> · this device</span>
              )}
            </p>
            <p className="text-muted-foreground mt-0.5">
              Signed in{" "}
              {new Date(session.createdAt).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
              {session.ipAddress && ` · ${session.ipAddress}`}
            </p>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={signOutOthers}
        disabled={pending || others === 0}
      >
        {pending ? "Signing out…" : "Sign out other devices"}
      </Button>
    </section>
  );
}

function shorten(userAgent: string): string {
  if (/iphone|ipad/i.test(userAgent)) return "iPhone or iPad";
  if (/android/i.test(userAgent)) return "Android device";
  if (/edg/i.test(userAgent)) return "Edge on desktop";
  if (/chrome/i.test(userAgent)) return "Chrome on desktop";
  if (/firefox/i.test(userAgent)) return "Firefox on desktop";
  if (/safari/i.test(userAgent)) return "Safari on desktop";
  return userAgent.slice(0, 40);
}

/**
 * Guardian view, visible and switched off.
 *
 * Kept on the screen rather than removed so the product is honest about the
 * feature existing and about why it does not work yet. A parent-visibility
 * feature that shipped before it was reviewed would be the single most
 * damaging thing this product could get wrong.
 */
export function GuardianView() {
  return (
    <section className="bg-surface-2/40 rounded-xl border border-dashed p-4">
      <h2 className="flex items-center gap-2 text-base font-medium">
        <Users className="text-muted-foreground size-4" aria-hidden />
        Guardian view
      </h2>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        Would let a parent or guardian see a limited summary. Switched off until legally
        reviewed — a feature that shows one person another person&rsquo;s life needs more
        than good intentions behind it.
      </p>
      <Button variant="outline" size="sm" disabled className="mt-3">
        Switched off
      </Button>
    </section>
  );
}

/**
 * Account deletion.
 *
 * Three gates: the typed phrase, the freshness of the session, and a summary
 * of exactly what is about to go. The button stays disabled until the phrase
 * matches, so the confirmation is read rather than clicked past.
 */
export function DeleteAccount({
  action,
  dataSummary,
  sessionFresh,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  dataSummary: AccountView["dataSummary"];
  sessionFresh: boolean;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === DELETE_PHRASE;

  return (
    <ActionForm
      action={action}
      className="border-risk/30 bg-risk/5 space-y-3 rounded-xl border p-4"
    >
      {({ pending, fieldErrors, result }) => (
        <>
          <h2 className="flex items-center gap-2 text-base font-medium">
            <ShieldAlert className="text-risk size-4" aria-hidden />
            Delete my twin
          </h2>
          <p className="text-xs leading-relaxed">
            Deletes your account and everything in it, immediately and permanently. There
            is no recovery and we keep no copy. Export first if you want one.
          </p>

          {dataSummary.length > 0 && (
            <div>
              <p className="text-xs font-medium">This removes:</p>
              <ul className="text-muted-foreground mt-1 grid gap-0.5 text-xs sm:grid-cols-2">
                {dataSummary.map((row) => (
                  <li key={row.label}>
                    <span className="tabular font-mono">{row.count}</span> {row.label.toLowerCase()}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!sessionFresh && (
            <p className="text-attention border-attention/35 bg-attention/10 rounded-lg border px-3 py-2 text-xs">
              Sign out and sign back in first, then delete within ten minutes. This stops
              somebody who finds your laptop unlocked from deleting your account.
            </p>
          )}

          <div>
            <Label htmlFor="confirmation" className="text-xs">
              Type <span className="font-mono">{DELETE_PHRASE}</span> to confirm
            </Label>
            <Input
              id="confirmation"
              name="confirmation"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="max-w-xs"
            />
            <FieldError message={fieldErrors.confirmation} />
          </div>

          <FormError result={result} />

          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={pending || !matches || !sessionFresh}
            className="border-risk/50 text-risk"
          >
            {pending ? "Deleting…" : "Delete my twin permanently"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}
