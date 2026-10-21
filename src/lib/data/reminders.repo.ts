/**
 * The Reminders module's data boundary, plus the delivery run.
 *
 * Nothing in this file composes its own copy. Every notification body comes
 * from `neutralCopy`, which contains no digits and no health or money
 * vocabulary — so there is no code path by which a weight or an amount can
 * reach a lock screen, even if a future caller wanted to put one there.
 */

import { connection } from "next/server";

import { remindersView } from "@/lib/data/module-fixtures";
import { getPrisma } from "@/lib/db";
import {
  DEFAULT_RULES,
  dueReminders,
  neutralCopy,
  sendDecision,
  unreadCount,
  type DueCandidate,
  type Prefs,
  type ReminderChannel,
  type ReminderKind,
  type RuleRow,
} from "@/lib/domain/calc/reminders";
import { readDevOutbox, sendReminderEmail } from "@/lib/integrations/mailer";
import type {
  NotificationPrefsInput,
  ReminderRuleInput,
} from "@/lib/validation/reminders";

/* -------------------------------------------------------------------------- */
/*                                   views                                    */
/* -------------------------------------------------------------------------- */

export type NotificationView = {
  id: string;
  kind: ReminderKind;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type RuleView = {
  id: string;
  kind: ReminderKind;
  enabled: boolean;
  leadMinutes: number;
  channel: ReminderChannel;
  label: string | null;
};

export type RemindersView = {
  prefs: Prefs;
  rules: RuleView[];
  notifications: NotificationView[];
  unread: number;
  /** How many were sent today, against the cap. Shown so the cap is visible. */
  sentToday: number;
  /** Recent dev-outbox entries. Empty once Mailjet is configured. */
  outbox: { to: string; subject: string; createdAt: string }[];
};

export type RemindersRepo = {
  getReminders(now?: Date): Promise<RemindersView>;
  savePrefs(input: NotificationPrefsInput): Promise<void>;
  saveRule(input: ReminderRuleInput): Promise<void>;
  toggleRule(ruleId: string, enabled: boolean): Promise<void>;
  deleteRule(ruleId: string): Promise<void>;
  markRead(notificationId: string): Promise<void>;
  markAllRead(): Promise<void>;
  /** Returns whether it actually went out, and why not if it did not. */
  sendTest(now?: Date): Promise<{ sent: boolean; reason?: string }>;
};

/* -------------------------------------------------------------------------- */
/*                                  per user                                  */
/* -------------------------------------------------------------------------- */

export function remindersRepoForUser(userId: string): RemindersRepo {
  const prisma = getPrisma();

  /** Prefs, with the documented defaults when the row does not exist yet. */
  async function loadPrefs(): Promise<Prefs> {
    const row = await prisma.notificationPrefs.findUnique({ where: { userId } });

    return {
      quietHoursStart: row?.quietHoursStart ?? 22,
      quietHoursEnd: row?.quietHoursEnd ?? 7,
      dailyCap: row?.dailyCap ?? 3,
      emailEnabled: row?.emailEnabled ?? false,
      timezone: row?.timezone ?? "Asia/Kolkata",
    };
  }

  async function countSentToday(now: Date): Promise<number> {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    return prisma.notification.count({
      where: { userId, createdAt: { gte: start } },
    });
  }

  return {
    async getReminders(now = new Date()) {
      await connection();

      const [prefsRow, rules, notifications] = await Promise.all([
        prisma.notificationPrefs.findUnique({ where: { userId } }),
        prisma.reminderRule.findMany({ where: { userId }, orderBy: { kind: "asc" } }),
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ]);

      const prefs: Prefs = {
        quietHoursStart: prefsRow?.quietHoursStart ?? 22,
        quietHoursEnd: prefsRow?.quietHoursEnd ?? 7,
        dailyCap: prefsRow?.dailyCap ?? 3,
        emailEnabled: prefsRow?.emailEnabled ?? false,
        timezone: prefsRow?.timezone ?? "Asia/Kolkata",
      };

      /* A new account has no rule rows yet. The defaults are shown as the
         switched-off/on state they will be saved with, so the editor is never
         an empty list the user has to populate before it means anything. */
      const ruleViews: RuleView[] =
        rules.length > 0
          ? rules.map((rule) => ({
              id: rule.id,
              kind: rule.kind as ReminderKind,
              enabled: rule.enabled,
              leadMinutes: rule.leadMinutes,
              channel: rule.channel as ReminderChannel,
              label: rule.label,
            }))
          : DEFAULT_RULES.map((rule) => ({
              id: `default-${rule.kind}`,
              kind: rule.kind,
              enabled: rule.enabled,
              leadMinutes: rule.leadMinutes,
              channel: rule.channel,
              label: null,
            }));

      return {
        prefs,
        rules: ruleViews,
        notifications: notifications.map((row) => ({
          id: row.id,
          kind: row.kind as ReminderKind,
          title: row.title,
          body: row.body,
          link: row.link,
          readAt: row.readAt ? row.readAt.toISOString() : null,
          createdAt: row.createdAt.toISOString(),
        })),
        unread: unreadCount(notifications),
        sentToday: await countSentToday(now),
        outbox: (await readDevOutbox(undefined, 5)).map((row) => ({
          to: row.to,
          subject: row.subject,
          createdAt: row.createdAt.toISOString(),
        })),
      };
    },

    async savePrefs(input) {
      await prisma.notificationPrefs.upsert({
        where: { userId },
        create: { userId, ...input },
        update: input,
      });
    },

    /**
     * Upsert one rule.
     *
     * Keyed on `[userId, kind, label]`, so toggling "Deadlines" edits the one
     * deadline rule rather than adding a second — which is what a user who
     * toggles a switch twice expects.
     */
    async saveRule(input) {
      const existing = await prisma.reminderRule.findFirst({
        where: { userId, kind: input.kind, label: input.label ?? null },
        select: { id: true },
      });

      if (existing) {
        await prisma.reminderRule.update({
          where: { id: existing.id },
          data: {
            enabled: input.enabled,
            leadMinutes: input.leadMinutes,
            channel: input.channel,
          },
        });
        return;
      }

      await prisma.reminderRule.create({
        data: {
          userId,
          kind: input.kind,
          enabled: input.enabled,
          leadMinutes: input.leadMinutes,
          channel: input.channel,
          label: input.label ?? null,
        },
      });
    },

    /**
     * Flip one switch.
     *
     * A `default-` id means the user is toggling a rule that has never been
     * saved, so the default is materialised with the new value rather than
     * failing on a row that does not exist.
     */
    async toggleRule(ruleId, enabled) {
      if (ruleId.startsWith("default-")) {
        const kind = ruleId.slice("default-".length) as ReminderKind;
        const preset = DEFAULT_RULES.find((rule) => rule.kind === kind);
        if (!preset) throw new Error("That reminder could not be found.");

        await prisma.reminderRule.create({
          data: {
            userId,
            kind,
            enabled,
            leadMinutes: preset.leadMinutes,
            channel: preset.channel,
          },
        });
        return;
      }

      await prisma.reminderRule.updateMany({
        where: { id: ruleId, userId },
        data: { enabled },
      });
    },

    async deleteRule(ruleId) {
      await prisma.reminderRule.deleteMany({ where: { id: ruleId, userId } });
    },

    async markRead(notificationId) {
      await prisma.notification.updateMany({
        where: { id: notificationId, userId, readAt: null },
        data: { readAt: new Date() },
      });
    },

    async markAllRead() {
      await prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      });
    },

    /**
     * "Send me a test reminder."
     *
     * Goes through the same gate a real reminder does, so the button also
     * demonstrates the guardrails: inside quiet hours it declines and says so,
     * which is more useful than a reminder that arrives at 2am to prove it can.
     */
    async sendTest(now = new Date()) {
      const prefs = await loadPrefs();
      const decision = sendDecision(now, prefs, await countSentToday(now));

      if (!decision.send) return { sent: false, reason: decision.reason };

      const copy = neutralCopy("CUSTOM");

      await prisma.notification.create({
        data: {
          userId,
          kind: "CUSTOM",
          title: copy.title,
          body: copy.body,
          link: "/reminders",
        },
      });

      if (prefs.emailEnabled) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });

        if (user) {
          /* A count and a link. The email cannot carry the detail. */
          await sendReminderEmail(user.email, user.name || user.email, 1, appUrl("/reminders"));
        }
      }

      return { sent: true };
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                               the delivery run                             */
/* -------------------------------------------------------------------------- */

/**
 * Evaluate and deliver everything due, for one user.
 *
 * Order matters: quiet hours and the cap are checked before anything is
 * written, and the cap is re-checked per notification so a run that starts
 * with one slot left does not post five.
 */
export async function deliverRemindersForUser(
  userId: string,
  now: Date,
): Promise<{ sent: number; skipped: string | null }> {
  const prisma = getPrisma();

  const [prefsRow, rules, commitments, tasks] = await Promise.all([
    prisma.notificationPrefs.findUnique({ where: { userId } }),
    prisma.reminderRule.findMany({ where: { userId, enabled: true } }),
    prisma.commitment.findMany({
      where: { userId, start: { gte: now } },
      orderBy: { start: "asc" },
      take: 50,
    }),
    prisma.task.findMany({
      where: { userId, done: false, due: { gte: now } },
      orderBy: { due: "asc" },
      take: 50,
    }),
  ]);

  const prefs: Prefs = {
    quietHoursStart: prefsRow?.quietHoursStart ?? 22,
    quietHoursEnd: prefsRow?.quietHoursEnd ?? 7,
    dailyCap: prefsRow?.dailyCap ?? 3,
    emailEnabled: prefsRow?.emailEnabled ?? false,
    timezone: prefsRow?.timezone ?? "Asia/Kolkata",
  };

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  let sentToday = await prisma.notification.count({
    where: { userId, createdAt: { gte: startOfToday } },
  });

  const gate = sendDecision(now, prefs, sentToday);
  if (!gate.send) return { sent: 0, skipped: gate.reason };

  const candidates: DueCandidate[] = [
    ...tasks
      .filter((task) => task.due)
      .map((task) => ({
        id: task.id,
        kind: "DEADLINE" as ReminderKind,
        title: task.title,
        at: task.due!.toISOString(),
      })),
    ...commitments
      .filter((commitment) => commitment.start && commitment.domain === "HEALTH")
      .map((commitment) => ({
        id: commitment.id,
        kind: "WORKOUT" as ReminderKind,
        title: commitment.title,
        at: commitment.start!.toISOString(),
      })),
  ];

  const ruleRows: RuleRow[] = rules.map((rule) => ({
    id: rule.id,
    kind: rule.kind as ReminderKind,
    enabled: rule.enabled,
    leadMinutes: rule.leadMinutes,
    channel: rule.channel as ReminderChannel,
    label: rule.label,
  }));

  const due = dueReminders(ruleRows, candidates, now);

  let sent = 0;

  for (const reminder of due) {
    if (!sendDecision(now, prefs, sentToday).send) break;

    /* One notification per thing per day. Without this, every cron tick
       inside the lead window would post the same reminder again. */
    const already = await prisma.notification.findFirst({
      where: {
        userId,
        kind: reminder.kind,
        link: `/${reminder.kind === "DEADLINE" ? "productivity" : "health"}`,
        createdAt: { gte: startOfToday },
      },
      select: { id: true },
    });
    if (already) continue;

    await prisma.notification.create({
      data: {
        userId,
        kind: reminder.kind,
        title: reminder.title,
        body: reminder.body,
        link: reminder.kind === "DEADLINE" ? "/productivity" : "/health",
      },
    });

    sent += 1;
    sentToday += 1;
  }

  if (sent > 0 && prefs.emailEnabled) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user) {
      await sendReminderEmail(user.email, user.name || user.email, sent, appUrl("/home"));
    }
  }

  return { sent, skipped: null };
}

export async function deliverRemindersForAllUsers(now: Date) {
  const users = await getPrisma().user.findMany({ select: { id: true } });

  let sent = 0;
  let considered = 0;

  for (const user of users) {
    const result = await deliverRemindersForUser(user.id, now);
    sent += result.sent;
    considered += 1;
  }

  return { users: considered, sent };
}

function appUrl(path: string): string {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

/* -------------------------------------------------------------------------- */
/*                                    demo                                    */
/* -------------------------------------------------------------------------- */

export const demoRemindersRepo: RemindersRepo = {
  async getReminders(now = new Date()) {
    await connection();
    return remindersView(now);
  },

  async savePrefs() {},
  async saveRule() {},
  async toggleRule() {},
  async deleteRule() {},
  async markRead() {},
  async markAllRead() {},
  async sendTest() {
    /* The demo reports success without writing: the visitor sees the flow,
       and no row and no email leave the process. */
    return { sent: true };
  },
};
