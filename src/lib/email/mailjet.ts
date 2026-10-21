/**
 * The Mailjet transport, and the one HTML shell every email uses.
 *
 * Called over fetch rather than through the SDK: this is one authenticated
 * POST, and the SDK would be a dependency carrying its own HTTP client for no
 * added behaviour.
 *
 * This file is transport only. Which mailer is used, what the messages say and
 * the development outbox all live in src/lib/integrations/mailer.ts — so the
 * decision "is Mailjet configured?" is made in exactly one place.
 */

import type { MailMessage } from "@/lib/integrations/mailer";

const ENDPOINT = "https://api.mailjet.com/v3.1/send";

function credentials() {
  const apiKey = process.env.MAILJET_API_KEY;
  const secretKey = process.env.MAILJET_SECRET_KEY;
  const from = process.env.MAILJET_FROM_EMAIL;

  if (!apiKey || !secretKey || !from) return null;

  return { apiKey, secretKey, from };
}

/** True when all three Mailjet variables are present. */
export function hasMailjet(): boolean {
  return credentials() !== null;
}

export async function sendViaMailjet(message: MailMessage): Promise<void> {
  const creds = credentials();

  if (!creds) {
    /* Unreachable through getMailer(), which only selects this transport when
       the credentials exist. Kept as a thrown error rather than a silent
       return so that calling it directly fails loudly. */
    throw new Error(
      "Mailjet is not configured: set MAILJET_API_KEY, MAILJET_SECRET_KEY and MAILJET_FROM_EMAIL.",
    );
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

/**
 * The shell every email shares. Inline styles and a table layout because that
 * is what mail clients actually render; the colours are the product's own
 * light-theme tokens, hard-coded here since an email cannot read CSS variables.
 */
export function emailLayout(
  heading: string,
  body: string,
  action: { href: string; label: string },
) {
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
