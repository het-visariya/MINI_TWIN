/**
 * Outbound email, behind one interface.
 *
 * Two implementations, chosen by whether Mailjet is configured:
 *
 *   - `ConsoleMailer` (development): prints to the server terminal *and*
 *     writes to the `DevEmail` table. The table is what makes the signup and
 *     password-reset flows testable end to end — a test reads the verification
 *     link out of the outbox instead of needing a real inbox.
 *   - `MailjetMailer`: the real send, selected only when MAILJET_API_KEY,
 *     MAILJET_SECRET_KEY and MAILJET_FROM_EMAIL are all present.
 *
 * The privacy rule holds in both: an email never carries a health figure, an
 * amount of money, a task title or a subject name. The templates below take a
 * count and a link, so there is nothing sensitive for them to leak.
 */

import { emailLayout, hasMailjet, sendViaMailjet } from "@/lib/email/mailjet";
import { getPrisma, hasDatabase } from "@/lib/db";

export type MailMessage = {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  html?: string;
};

export interface Mailer {
  readonly kind: "console" | "mailjet";
  send(message: MailMessage): Promise<void>;
}

/**
 * Development. Writes the message where a human and a test can both find it.
 *
 * The database write is best-effort on purpose: with no DATABASE_URL the app
 * still runs its landing page and demo mode, and a missing outbox must not be
 * the thing that breaks a signup attempt.
 */
export const consoleMailer: Mailer = {
  kind: "console",

  async send(message) {
    console.info(
      [
        "",
        "[email — Mailjet not configured, written to the dev outbox]",
        `  to:      ${message.to}`,
        `  subject: ${message.subject}`,
        "",
        message.text,
        "",
      ].join("\n"),
    );

    if (!hasDatabase()) return;

    try {
      await getPrisma().devEmail.create({
        data: {
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html ?? null,
        },
      });
    } catch (error) {
      console.warn(
        `[email] could not write to the dev outbox: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  },
};

export const mailjetMailer: Mailer = {
  kind: "mailjet",
  send: sendViaMailjet,
};

/**
 * Mailjet when it is configured, the dev outbox otherwise.
 *
 * In production an unconfigured mailer throws instead of falling back. A
 * silent console write there would mean nobody ever receives a verification
 * link and the signup flow appears to work — the worst kind of failure,
 * because it looks like success from the inside.
 */
export function getMailer(): Mailer {
  if (hasMailjet()) return mailjetMailer;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Mailjet is not configured: set MAILJET_API_KEY, MAILJET_SECRET_KEY and MAILJET_FROM_EMAIL.",
    );
  }

  return consoleMailer;
}

/* -------------------------------------------------------------------------- */
/*                                 templates                                  */
/* -------------------------------------------------------------------------- */

export function sendVerificationEmail(to: string, name: string, url: string) {
  return getMailer().send({
    to,
    toName: name,
    subject: "Confirm your email address",
    text: `Confirm your email address to finish setting up your twin:\n\n${url}\n\nThe link expires in an hour. If you did not create an account, you can ignore this email.`,
    html: emailLayout(
      "Confirm your email",
      "One tap and your twin is ready to set up. The link expires in an hour — if you did not create an account, you can ignore this email.",
      { href: url, label: "Confirm email address" },
    ),
  });
}

export function sendPasswordResetEmail(to: string, name: string, url: string) {
  return getMailer().send({
    to,
    toName: name,
    subject: "Reset your password",
    text: `Use this link to choose a new password:\n\n${url}\n\nThe link expires in an hour. If you did not ask for this, nothing has changed and you can ignore this email.`,
    html: emailLayout(
      "Reset your password",
      "Choose a new password using the link below. It expires in an hour. If you did not ask for this, nothing has changed and you can ignore this email.",
      { href: url, label: "Choose a new password" },
    ),
  });
}

/**
 * Reminder mail.
 *
 * Takes a count, never the items. No task title, subject name, amount or
 * health figure leaves the app by email — which is why this signature cannot
 * accept one even if a caller wanted to pass it.
 */
export function sendReminderEmail(
  to: string,
  name: string,
  dueCount: number,
  url: string,
) {
  const what = dueCount === 1 ? "one thing" : `${dueCount} things`;

  return getMailer().send({
    to,
    toName: name,
    subject: "Your twin has an update",
    text: `You have ${what} waiting in Digital Twin today.\n\n${url}\n\nTo change or stop these, open Settings and adjust your reminders.`,
    html: emailLayout(
      "Your twin has an update",
      `You have ${what} waiting today. Open the app to see what they are — we keep the details out of email on purpose.`,
      { href: url, label: "Open Digital Twin" },
    ),
  });
}

/* -------------------------------------------------------------------------- */
/*                                 dev outbox                                 */
/* -------------------------------------------------------------------------- */

/**
 * The most recent development emails, newest first.
 *
 * Read by the Reminders screen's "send me a test reminder" confirmation and by
 * the end-to-end tests. Returns nothing when Mailjet is configured, because
 * then there is no outbox to read.
 */
export async function readDevOutbox(to?: string, take = 20) {
  if (!hasDatabase()) return [];

  return getPrisma().devEmail.findMany({
    where: to ? { to } : undefined,
    orderBy: { createdAt: "desc" },
    take,
  });
}
