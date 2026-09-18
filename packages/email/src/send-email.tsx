import { render } from "@react-email/components";
import { config } from "dotenv-mono";
import type { ReactElement } from "react";
import type { MagicLinkEmailProps } from "./templates/auth/magic-link";
import MagicLinkEmail from "./templates/auth/magic-link";
import type { OtpEmailProps } from "./templates/auth/otp";
import OtpEmail from "./templates/auth/otp";
import PasswordResetEmail, {
  type PasswordResetEmailProps,
} from "./templates/auth/password-reset";
import ActivityEmail, {
  type ActivityEmailProps,
} from "./templates/notifications/activity";
import NotificationEmail, {
  type NotificationEmailProps,
} from "./templates/notifications/generic";
import WorkspaceInvitationEmail, {
  type WorkspaceInvitationEmailProps,
} from "./templates/workspace/invitation";
import TrialReminderEmail, {
  type TrialReminderEmailProps,
} from "./templates/workspace/trial-reminder";
import { deliverEmail, isEmailConfigured } from "./transport";

config();

/** Renders HTML plus a plain-text copy (better inbox placement) and sends. */
async function send(
  to: string,
  subject: string,
  element: ReactElement,
  tags?: { name: string; value: string }[],
) {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return deliverEmail({ to, subject, html, text, tags });
}

export const sendMagicLinkEmail = async (
  to: string,
  subject: string,
  data: MagicLinkEmailProps,
) => {
  try {
    await send(to, subject, MagicLinkEmail(data));
  } catch (error) {
    console.error("Error sending magic link email", error);
  }
};

export const sendOtpEmail = async (
  to: string,
  subject: string,
  data: OtpEmailProps,
) => {
  try {
    await send(to, subject, OtpEmail(data));
  } catch (error) {
    console.error("Error sending OTP email", error);
  }
};

export const sendPasswordResetEmail = async (
  to: string,
  subject: string,
  data: PasswordResetEmailProps,
) => {
  try {
    await send(to, subject, PasswordResetEmail(data));
  } catch (error) {
    console.error("Error sending password reset email", error);
  }
};

export type EmailResult = {
  success: boolean;
  // Kept for existing callers; it means no email provider at all.
  reason?: "SMTP_NOT_CONFIGURED";
};

export const sendWorkspaceInvitationEmail = async (
  to: string,
  subject: string,
  data: WorkspaceInvitationEmailProps,
): Promise<EmailResult> => {
  if (!isEmailConfigured()) {
    return { success: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  try {
    await send(to, subject, WorkspaceInvitationEmail({ ...data, to }), [
      { name: "category", value: "invitation" },
    ]);
    return { success: true };
  } catch (error) {
    console.error("Error sending workspace invitation email", error);
    throw error;
  }
};

export const sendNotificationEmail = async (
  to: string,
  subject: string,
  data: NotificationEmailProps,
): Promise<EmailResult> => {
  if (!isEmailConfigured()) {
    return { success: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  try {
    await send(to, subject, NotificationEmail(data));
    return { success: true };
  } catch (error) {
    console.error("Error sending notification email", error);
    throw error;
  }
};

export const sendTrialReminderEmail = async (
  to: string,
  subject: string,
  data: TrialReminderEmailProps,
) => {
  try {
    await send(to, subject, TrialReminderEmail(data));
  } catch (error) {
    console.error("Error sending trial reminder email", error);
  }
};

/** Rich notification email (task, leave, …) in the shared mother layout. */
export const sendActivityEmail = async (
  to: string,
  subject: string,
  data: ActivityEmailProps,
  category?: string,
): Promise<EmailResult> => {
  if (!isEmailConfigured()) {
    return { success: false, reason: "SMTP_NOT_CONFIGURED" };
  }
  await send(
    to,
    subject,
    ActivityEmail(data),
    category ? [{ name: "category", value: category }] : undefined,
  );
  return { success: true };
};

/** HTML and plain text for an activity email, for callers that queue mail. */
export const renderActivityEmail = async (data: ActivityEmailProps) => {
  const element = ActivityEmail(data);
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { html, text };
};
