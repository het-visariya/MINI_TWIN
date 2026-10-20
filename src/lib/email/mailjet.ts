/**
 * Transactional email through Mailjet's Send v3.1 API.
 *
 * Called over fetch rather than through the SDK: this is one authenticated
 * POST, and the SDK would be a dependency carrying its own HTTP client for no
 * added behaviour.
 *
 * Privacy rule, enforced by the callers in this file rather than left to
 * whoever writes the next reminder: an email never contains health or money
 * detail. "You have something due today" is allowed; the subject name, the
 * amount and the weight are not.
 */

const ENDPOINT = "https://api.mailjet.com/v3.1/send";

type Message = {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  html?: string;
};

function credentials() {
  const apiKey = process.env.MAILJET_API_KEY;
  const secretKey = process.env.MAILJET_SECRET_KEY;
  const from = process.env.MAILJET_FROM_EMAIL;

  if (!apiKey || !secretKey || !from) return null;

  return { apiKey, secretKey, from };
}

export async function sendEmail(message: Message): Promise<void> {
  const creds = credentials();

  if (!creds) {
    // In development an unconfigured mailer should not block the signup flow:
    // print the link so it can be followed from the terminal. In production a
    // silent no-op would mean users never receive verification mail, so it
    // fails loudly instead.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Mailjet is not configured: set MAILJET_API_KEY, MAILJET_SECRET_KEY and MAILJET_FROM_EMAIL.",
      );
    }

    console.info(
      `\n[email: Mailjet not configured, printing instead]\n  to:      ${message.to}\n  subject: ${message.subject}\n\n${message.text}\n`,
    );
    return;
  }

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${Buffer.from(
        `${creds.apiKey}:${creds.secretKey}`,
      ).toString("base64")}`,
    },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: creds.from, Name: "Digital Twin" },
          To: [{ Email: message.to, Name: message.toName ?? message.to }],
          Subject: message.subject,
          TextPart: message.text,
          ...(message.html ? { HTMLPart: message.html } : {}),
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Mailjet rejected the message (${response.status}). ${detail.slice(0, 300)}`,
    );
  }
}

/* --------------------------- the three auth emails -------------------------- */

function layout(heading: string, body: string, action: { href: string; label: string }) {
  return `<!doctype html><html><body style="margin:0;background:#FAFAF8;font-family:ui-sans-serif,system-ui,sans-serif;color:#0A0A0A">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" style="max-width:480px;background:#FFFFFF;border:1px solid #E6E6E1;border-radius:12px"><tr><td style="padding:28px">
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:500;letter-spacing:-0.01em">${heading}</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#5F5F5A">${body}</p>
      <a href="${action.href}" style="display:inline-block;background:#587400;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:500;padding:11px 18px;border-radius:8px">${action.label}</a>
      <p style="margin:20px 0 0;font-size:12px;line-height:18px;color:#5F5F5A">If the button does not work, paste this into your browser:<br><span style="word-break:break-all">${action.href}</span></p>
    </td></tr></table>
  </td></tr></table>
</body></html>`;
}

export function sendVerificationEmail(to: string, name: string, url: string) {
  return sendEmail({
    to,
    toName: name,
    subject: "Confirm your email address",
    text: `Confirm your email address to finish setting up your twin:\n\n${url}\n\nThe link expires in an hour. If you did not create an account, you can ignore this email.`,
    html: layout(
      "Confirm your email",
      "One tap and your twin is ready to set up. The link expires in an hour — if you did not create an account, you can ignore this email.",
      { href: url, label: "Confirm email address" },
    ),
  });
}

export function sendPasswordResetEmail(to: string, name: string, url: string) {
  return sendEmail({
    to,
    toName: name,
    subject: "Reset your password",
    text: `Use this link to choose a new password:\n\n${url}\n\nThe link expires in an hour. If you did not ask for this, nothing has changed and you can ignore this email.`,
    html: layout(
      "Reset your password",
      "Choose a new password using the link below. It expires in an hour. If you did not ask for this, nothing has changed and you can ignore this email.",
      { href: url, label: "Choose a new password" },
    ),
  });
}

/**
 * Reminder mail. Deliberately takes a count rather than the items: no task
 * title, subject, amount or health figure leaves the app by email.
 */
export function sendReminderEmail(to: string, name: string, dueCount: number, url: string) {
  const what = dueCount === 1 ? "one thing" : `${dueCount} things`;

  return sendEmail({
    to,
    toName: name,
    subject: "Your twin has an update",
    text: `You have ${what} waiting in Digital Twin today.\n\n${url}\n\nTo change or stop these, open Settings and adjust your reminders.`,
    html: layout(
      "Your twin has an update",
      `You have ${what} waiting today. Open the app to see what they are — we keep the details out of email on purpose.`,
      { href: url, label: "Open Digital Twin" },
    ),
  });
}
