// Email delivery (ADR-0014): Resend in production, Mailpit locally, in-memory in tests.
// All transports use fetch, so this runs unchanged on Cloudflare Workers.
import { env } from "./env";
import { log } from "./log";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Emails captured when EMAIL_TRANSPORT=memory (tests read magic links from here). */
export const outbox: Email[] = [];

export async function sendEmail(email: Email): Promise<void> {
  const e = env();
  const transport =
    e.EMAIL_TRANSPORT === "auto" ? (e.RESEND_API_KEY ? "resend" : "mailpit") : e.EMAIL_TRANSPORT;
  if (transport === "memory") {
    outbox.push(email);
    return;
  }
  if (transport === "file") {
    const { appendFileSync, mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    mkdirSync(dirname(e.MAIL_FILE), { recursive: true });
    appendFileSync(e.MAIL_FILE, JSON.stringify(email) + "\n");
    return;
  }
  if (transport === "console") {
    log.info("email.console", { to: "[redacted]", subject: email.subject, text: email.text });
    return;
  }
  if (transport === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: e.EMAIL_FROM,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    });
    if (!res.ok) throw new Error(`Resend responded ${res.status}`);
    return;
  }
  // Mailpit's send API (docker compose). If Mailpit isn't running, fall back to the console
  // so local sign-in still works.
  try {
    const res = await fetch(`${e.MAILPIT_URL}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: "no-reply@example.com", Name: "AI Engineering Handbook" },
        To: [{ Email: email.to }],
        Subject: email.subject,
        Text: email.text,
        HTML: email.html,
      }),
    });
    if (!res.ok) throw new Error(`Mailpit responded ${res.status}`);
  } catch (err) {
    log.warn("email.mailpit_unavailable", { error: (err as Error).message });
    console.log(`\n[email] ${email.subject}\n${email.text}\n`);
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function magicLinkEmail(to: string, url: string): Email {
  return {
    to,
    subject: "Your sign-in link for The AI Engineering Handbook",
    text: `Sign in to The AI Engineering Handbook:\n\n${url}\n\nThis link works once and expires in 10 minutes. If you didn't ask for it, ignore this email.`,
    html: `<p>Sign in to <strong>The AI Engineering Handbook</strong>:</p><p><a href="${escapeHtml(url)}">Sign in</a></p><p>This link works once and expires in 10 minutes. If you didn't ask for it, ignore this email.</p>`,
  };
}
