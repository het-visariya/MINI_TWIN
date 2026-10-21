"use client";

import { BellRing, Check, Send } from "lucide-react";
import { useTransition } from "react";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "cn";
import { REMINDER_LABELS, type ReminderKind } from "@/lib/domain/calc/reminders";
import type { RuleView } from "@/lib/data/reminders.repo";
import type { ActionResult } from "@/lib/validation/shared";

const LEAD_OPTIONS = [
  { value: 0, label: "At the time" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 12 * 60, label: "12 hours before" },
  { value: 24 * 60, label: "1 day before" },
  { value: 48 * 60, label: "2 days before" },
];

/** What each kind of reminder is for, so a switch is never unlabelled. */
const RULE_BLURBS: Record<ReminderKind, string> = {
  DEADLINE: "Before something you have given a deadline.",
  ATTENDANCE: "When a subject slips below the rule you set.",
  WORKOUT: "Before a session you have put in the calendar.",
  WATER: "A nudge to open the short check-in.",
  WEEKLY_REVIEW: "Once a week, when your review is ready to read.",
  CUSTOM: "Reminders you set up yourself.",
};

/**
 * The rules editor.
 *
 * Each row is its own form, so toggling one switch cannot lose an unsaved edit
 * in another. The switch submits immediately — a switch with a separate Save
 * button is a switch that gets left unsaved.
 */
export function RulesEditor({
  rules,
  toggleAction,
  saveAction,
}: {
  rules: RuleView[];
  toggleAction: (formData: FormData) => Promise<ActionResult>;
  saveAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const [pending, startTransition] = useTransition();

  const toggle = (ruleId: string, enabled: boolean) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("ruleId", ruleId);
      formData.set("enabled", String(enabled));

      const result = await toggleAction(formData);
      if (!result.ok) toast.error(result.error);
    });
  };

  return (
    <ul className="space-y-3">
      {rules.map((rule) => (
        <li key={rule.id} className="bg-surface-2/50 rounded-lg border p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{REMINDER_LABELS[rule.kind]}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {RULE_BLURBS[rule.kind]}
              </p>
            </div>

            <Switch
              checked={rule.enabled}
              disabled={pending}
              onCheckedChange={(checked) => toggle(rule.id, checked)}
              aria-label={`${REMINDER_LABELS[rule.kind]} reminders`}
            />
          </div>

          {rule.enabled && (
            <ActionForm action={saveAction} successMessage="Updated." className="mt-3">
              {({ pending: saving }) => (
                <>
                  <input type="hidden" name="kind" value={rule.kind} />
                  <input type="hidden" name="enabled" value="true" />

                  <div className="flex flex-wrap items-end gap-2">
                    <div className="w-44">
                      <Label htmlFor={`lead-${rule.id}`} className="text-2xs">
                        When
                      </Label>
                      <Select name="leadMinutes" defaultValue={String(rule.leadMinutes)}>
                        <SelectTrigger id={`lead-${rule.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={String(option.value)}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-36">
                      <Label htmlFor={`channel-${rule.id}`} className="text-2xs">
                        How
                      </Label>
                      <Select name="channel" defaultValue={rule.channel}>
                        <SelectTrigger id={`channel-${rule.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IN_APP">In the app</SelectItem>
                          <SelectItem value="EMAIL">Email</SelectItem>
                          <SelectItem value="BOTH">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button type="submit" variant="ghost" size="sm" disabled={saving}>
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </>
              )}
            </ActionForm>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Quiet hours, the daily cap and the email switch.
 *
 * The cap maxes out at ten in the schema. A field that accepts five hundred is
 * a field that eventually holds five hundred, and the product's promise is
 * that it does not spam.
 */
export function PrefsForm({
  action,
  prefs,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  prefs: {
    quietHoursStart: number;
    quietHoursEnd: number;
    dailyCap: number;
    emailEnabled: boolean;
    timezone: string;
  };
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
            <h2 className="text-base font-medium">When your twin may interrupt</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Quiet hours are absolute. Nothing is sent inside them, including the test
              button.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="quietHoursStart" className="text-xs">
                Quiet from
              </Label>
              <Select name="quietHoursStart" defaultValue={String(prefs.quietHoursStart)}>
                <SelectTrigger id="quietHoursStart">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hours().map((hour) => (
                    <SelectItem key={hour.value} value={String(hour.value)}>
                      {hour.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="quietHoursEnd" className="text-xs">
                Until
              </Label>
              <Select name="quietHoursEnd" defaultValue={String(prefs.quietHoursEnd)}>
                <SelectTrigger id="quietHoursEnd">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hours().map((hour) => (
                    <SelectItem key={hour.value} value={String(hour.value)}>
                      {hour.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dailyCap" className="text-xs">
                At most, per day
              </Label>
              <Input
                id="dailyCap"
                name="dailyCap"
                type="number"
                inputMode="numeric"
                min={0}
                max={10}
                defaultValue={prefs.dailyCap}
              />
              <FieldError message={fieldErrors.dailyCap} />
            </div>

            <div>
              <Label htmlFor="timezone" className="text-xs">
                Time zone
              </Label>
              <Input
                id="timezone"
                name="timezone"
                defaultValue={prefs.timezone}
                placeholder="Asia/Kolkata"
              />
              <FieldError message={fieldErrors.timezone} />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="emailEnabled"
              value="true"
              defaultChecked={prefs.emailEnabled}
              className="accent-accent size-4"
            />
            <span>
              Also send by email
              <span className="text-muted-foreground block text-xs">
                Emails carry a count and a link, never the detail.
              </span>
            </span>
          </label>

          <FormError result={result} />

          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

/** Mark-all-read and the test button, which share a row. */
export function NotificationActions({
  markAllAction,
  testAction,
  unread,
}: {
  markAllAction: () => Promise<ActionResult>;
  testAction: () => Promise<ActionResult<{ sent: boolean; reason?: string }>>;
  unread: number;
}) {
  const [pending, startTransition] = useTransition();

  const markAll = () =>
    startTransition(async () => {
      const result = await markAllAction();
      if (!result.ok) toast.error(result.error);
    });

  const test = () =>
    startTransition(async () => {
      const result = await testAction();

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (result.data.sent) {
        toast.success("Sent. It is in your list below.");
      } else {
        /* The gate declined. Saying why is the useful part. */
        toast.info(`Not sent — ${result.data.reason}.`, {
          description: "That is the guardrail working, not a failure.",
        });
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={markAll}
        disabled={pending || unread === 0}
      >
        <Check aria-hidden />
        Mark all read
      </Button>

      <Button type="button" variant="outline" size="sm" onClick={test} disabled={pending}>
        <Send aria-hidden />
        Send me a test reminder
      </Button>
    </div>
  );
}

/** One notification, with mark-read. */
export function NotificationRow({
  action,
  notification,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  notification: {
    id: string;
    title: string;
    body: string;
    link: string | null;
    readAt: string | null;
    createdAt: string;
  };
}) {
  const [pending, startTransition] = useTransition();

  const read = () =>
    startTransition(async () => {
      const formData = new FormData();
      formData.set("notificationId", notification.id);

      const result = await action(formData);
      if (!result.ok) toast.error(result.error);
    });

  const unread = notification.readAt === null;

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3",
        unread ? "border-accent/30 bg-accent/5" : "bg-surface-2/40",
      )}
    >
      <BellRing
        className={cn("mt-0.5 size-4 shrink-0", unread ? "text-accent" : "text-muted-foreground")}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{notification.title}</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
          {notification.body}
        </p>
        <p className="text-muted-foreground mt-1 text-2xs">
          {new Date(notification.createdAt).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>

      {unread && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={read}
          disabled={pending}
          className="shrink-0"
        >
          Mark read
        </Button>
      )}
    </li>
  );
}

function hours() {
  return Array.from({ length: 24 }, (_, hour) => ({
    value: hour,
    label: `${String(hour).padStart(2, "0")}:00`,
  }));
}
