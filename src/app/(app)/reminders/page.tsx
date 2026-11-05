import { BellOff } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import {
  markAllRead,
  markRead,
  savePrefs,
  saveRule,
  sendTestReminder,
  toggleRule,
} from "@/app/(app)/reminders/actions";
import { ModuleTabs } from "@/components/patterns/module-tabs";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState, GridSkeleton } from "@/components/patterns/states";
import {
  NotificationActions,
  NotificationRow,
  PrefsForm,
  RulesEditor,
} from "@/components/reminders/reminder-controls";
import { getRemindersRepo } from "@/lib/data/repo";
import { isInQuietHours } from "@/lib/domain/calc/reminders";
import type { RemindersView } from "@/lib/data/reminders.repo";

export const metadata: Metadata = { title: "Reminders" };

export default function RemindersPage() {
  return (
    <Suspense fallback={<GridSkeleton count={3} />}>
      <RemindersContent />
    </Suspense>
  );
}

async function RemindersContent() {
  /*
   * Opt into request-time rendering *before* reading the clock.
   *
   * With `cacheComponents` on, Next prerenders what it can, and `new Date()`
   * in a prerender is a value that would be frozen into the HTML — so it
   * refuses it outright. The repo awaits `connection()` too, but that happens
   * after this component has already called the constructor, which is too
   * late. One line here, and the page is honestly dynamic: "today" and
   * "good evening" are only true for one request anyway.
   */
  await connection();

  const repo = await getRemindersRepo();
  const now = new Date();
  const view = await repo.getReminders(now);

  const quiet = isInQuietHours(now, view.prefs);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reminders"
        description="Neutral by design. A reminder tells you something is waiting; it never says what, because it may be read over your shoulder."
        askAbout="my reminders"
      />

      <ModuleTabs
        tabs={[
          {
            value: "inbox",
            label: view.unread > 0 ? `Inbox (${view.unread})` : "Inbox",
            content: <Inbox view={view} quiet={quiet} />,
          },
          {
            value: "rules",
            label: "What to remind me about",
            content: (
              <section className="bg-card shadow-card rounded-xl border p-4">
                <h2 className="text-base font-medium">Reminder rules</h2>
                <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
                  Deadlines and the weekly review are on to begin with. Everything else is
                  off until you ask for it.
                </p>
                <RulesEditor
                  rules={view.rules}
                  toggleAction={toggleRule}
                  saveAction={saveRule}
                />
              </section>
            ),
          },
          {
            value: "limits",
            label: "Quiet hours & cap",
            content: <PrefsForm action={savePrefs} prefs={view.prefs} />,
          },
        ]}
      />

      <p className="text-muted-foreground border-t pt-4 text-xs">
        No reminder ever contains a weight, an amount of money, a food or a medical detail.
        That is enforced in the code that writes them, not left to whoever adds the next
        one.
      </p>
    </div>
  );
}

function Inbox({ view, quiet }: { view: RemindersView; quiet: boolean }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <section aria-labelledby="inbox-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="inbox-heading" className="text-base font-medium">
            Your notifications
          </h2>
          <NotificationActions
            markAllAction={markAllRead}
            testAction={sendTestReminder}
            unread={view.unread}
          />
        </div>

        {view.notifications.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title="Nothing waiting"
            purpose="Reminders appear here when something you asked to be reminded about is coming up. Nothing is switched on that you did not choose."
            action={
              <p className="text-muted-foreground text-xs">
                Try &ldquo;Send me a test reminder&rdquo; to see what one looks like.
              </p>
            }
          />
        ) : (
          <ul className="space-y-2">
            {view.notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                action={markRead}
                notification={notification}
              />
            ))}
          </ul>
        )}
      </section>

      <div className="space-y-6">
        <section className="bg-card shadow-card rounded-xl border p-4">
          <h2 className="text-sm font-medium">Today</h2>

          <p className="tabular mt-2 font-mono text-2xl font-medium">
            {view.sentToday}
            <span className="text-muted-foreground text-base"> of {view.prefs.dailyCap}</span>
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Sent today, against your cap.
          </p>

          <p className="text-muted-foreground mt-3 border-t pt-2 text-xs">
            {quiet
              ? `You are inside your quiet hours (${pad(view.prefs.quietHoursStart)}:00 to ${pad(
                  view.prefs.quietHoursEnd,
                )}:00). Nothing will be sent until they end.`
              : `Quiet hours run ${pad(view.prefs.quietHoursStart)}:00 to ${pad(
                  view.prefs.quietHoursEnd,
                )}:00.`}
          </p>
        </section>

        {view.outbox.length > 0 && (
          <section className="bg-card shadow-card rounded-xl border p-4">
            <h2 className="text-sm font-medium">Development outbox</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              No email provider is configured, so messages are written here instead of
              being sent.
            </p>
            <ul className="mt-3 space-y-2">
              {view.outbox.map((mail, index) => (
                <li key={`${mail.createdAt}-${index}`} className="text-xs">
                  <p className="font-medium">{mail.subject}</p>
                  <p className="text-muted-foreground mt-0.5">
                    to {mail.to} ·{" "}
                    {new Date(mail.createdAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function pad(hour: number): string {
  return String(hour).padStart(2, "0");
}
