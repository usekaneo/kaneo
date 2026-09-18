import * as nodemailer from "nodemailer";
import { getSmtpTransportOptions } from "./smtp-config";

type Env = Record<string, string | undefined>;

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Resend tags, e.g. [{ name: "category", value: "leave" }]. */
  tags?: { name: string; value: string }[];
};

export type EmailProvider = "resend" | "smtp" | null;

/**
 * Resend when RESEND_API_KEY is set, otherwise SMTP. Self-hosted instances
 * keep working with plain SMTP; Resend is never required.
 */
export function emailProvider(env: Env = process.env): EmailProvider {
  if (env.RESEND_API_KEY && emailFrom(env)) return "resend";
  if (env.SMTP_HOST && env.SMTP_FROM) return "smtp";
  return null;
}

export function emailFrom(env: Env = process.env) {
  return env.EMAIL_FROM || env.RESEND_FROM || env.SMTP_FROM || null;
}

export function isEmailConfigured(env: Env = process.env) {
  return emailProvider(env) !== null;
}

// Created on first use so a process that never sends mail never opens SMTP.
let smtp: nodemailer.Transporter | null = null;

async function sendWithSmtp(email: OutgoingEmail, from: string) {
  smtp ??= nodemailer.createTransport(getSmtpTransportOptions());
  await smtp.sendMail({
    from,
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    replyTo: email.replyTo,
  });
}

const RESEND_URL = "https://api.resend.com/emails";

async function sendWithResend(
  email: OutgoingEmail,
  from: string,
  apiKey: string,
) {
  const response = await fetch(RESEND_URL, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      reply_to: email.replyTo,
      // Resend only accepts ASCII letters, numbers, _ and - in tags.
      tags: email.tags?.map((tag) => ({
        name: tag.name.replace(/[^\w-]/g, "_"),
        value: tag.value.replace(/[^\w-]/g, "_"),
      })),
    }),
  });
  if (!response.ok) {
    // Resend explains itself in JSON; never log the API key or the body.
    let reason = `${response.status}`;
    try {
      const data = (await response.json()) as { message?: string };
      if (data.message) reason = `${response.status} ${data.message}`;
    } catch {}
    throw new Error(`Resend rejected the email: ${reason}`);
  }
  const data = (await response.json()) as { id?: string };
  return data.id ?? null;
}

/** Sends one email with whichever provider is configured. Throws on failure. */
export async function deliverEmail(
  email: OutgoingEmail,
  env: Env = process.env,
): Promise<{ provider: Exclude<EmailProvider, null>; id: string | null }> {
  const provider = emailProvider(env);
  const from = emailFrom(env);
  if (!provider || !from) {
    throw new Error("Email is not configured");
  }
  if (provider === "resend") {
    const id = await sendWithResend(email, from, env.RESEND_API_KEY as string);
    return { provider, id };
  }
  await sendWithSmtp(email, from);
  return { provider, id: null };
}
