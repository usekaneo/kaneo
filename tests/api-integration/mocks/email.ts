import type { EmailResult } from "../../../packages/email/src/send-email";

export async function sendMagicLinkEmail(
  _to: string,
  _subject: string,
  _data: unknown,
): Promise<void> {
  return undefined;
}

export async function sendOtpEmail(
  _to: string,
  _subject: string,
  _data: unknown,
): Promise<void> {
  return undefined;
}

export async function sendWorkspaceInvitationEmail(
  _to: string,
  _subject: string,
  _data: unknown,
): Promise<EmailResult> {
  return { success: true };
}

export function isSmtpConfigured(): boolean {
  return false;
}

export function isEmailConfigured(): boolean {
  return false;
}

export async function sendNotificationEmail(): Promise<EmailResult> {
  return { success: true };
}

export async function sendActivityEmail(): Promise<EmailResult> {
  return { success: true };
}

export async function renderActivityEmail(): Promise<{
  html: string;
  text: string;
}> {
  return { html: "<p>email</p>", text: "email" };
}

export async function deliverEmail(): Promise<{
  provider: "resend";
  id: string;
}> {
  return { provider: "resend", id: "test" };
}
