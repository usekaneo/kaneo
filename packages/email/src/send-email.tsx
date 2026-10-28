import { createElement, type ReactElement } from "react";
import { render as renderEmail } from "react-email";
import { config } from "dotenv-mono";
import * as nodemailer from "nodemailer";
import { type EmailSubject, loadBrandName } from "./brand";
import { BrandNameContext } from "./components/brand-name-context";
import { instanceHost } from "./components/instance-host";
import { getSmtpTransportOptions, isSmtpConfigured } from "./smtp-config";
import { getSmtpErrorDetails } from "./smtp-error-details";
import AccountPasswordEmail, {
  type AccountPasswordEmailProps,
} from "./templates/account-password";
import EmailVerificationEmail, {
  type EmailVerificationEmailProps,
} from "./templates/email-verification";
import type { MagicLinkEmailProps } from "./templates/magic-link";
import MagicLinkEmail from "./templates/magic-link";
import NotificationEmail, {
  type NotificationEmailProps,
} from "./templates/notification";
import type { OtpEmailProps } from "./templates/otp";
import OtpEmail from "./templates/otp";
import TestEmail, { type TestEmailProps } from "./templates/test-email";
import PasswordResetEmail, {
  type PasswordResetEmailProps,
} from "./templates/password-reset";
import TrialReminderEmail, {
  type TrialReminderEmailProps,
} from "./templates/trial-reminder";
import WorkspaceInvitationEmail, {
  type WorkspaceInvitationEmailProps,
} from "./templates/workspace-invitation";

config();

const transporter = nodemailer.createTransport(getSmtpTransportOptions());

async function render(template: ReactElement, subject: EmailSubject) {
  const instanceName = await loadBrandName();
  const html = await renderEmail(
    createElement(BrandNameContext.Provider, { value: instanceName }, template),
  );
  return {
    html,
    subject: typeof subject === "function" ? subject(instanceName) : subject,
  };
}

export const sendMagicLinkEmail = async (
  to: string,
  subject: EmailSubject,
  data: MagicLinkEmailProps,
) => {
  const email = await render(
    MagicLinkEmail({ email: to, instance: instanceHost(), ...data }),
    subject,
  );
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      ...email,
    });
  } catch (error) {
    console.error("Error sending magic link email", error);
  }
};

export const sendOtpEmail = async (
  to: string,
  subject: EmailSubject,
  data: OtpEmailProps,
) => {
  const email = await render(
    OtpEmail({ email: to, instance: instanceHost(), ...data }),
    subject,
  );
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      ...email,
    });
  } catch (error) {
    console.error("Error sending OTP email", error);
  }
};

export const sendPasswordResetEmail = async (
  to: string,
  subject: EmailSubject,
  data: PasswordResetEmailProps,
) => {
  let email: Awaited<ReturnType<typeof render>>;
  try {
    email = await render(
      PasswordResetEmail({ email: to, instance: instanceHost(), ...data }),
      subject,
    );
  } catch {
    console.error("Error rendering password reset email");
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      ...email,
    });
  } catch (error) {
    console.error(
      "Error sending password reset email",
      getSmtpErrorDetails(error),
    );
  }
};

export type EmailResult = {
  success: boolean;
  reason?: "SMTP_NOT_CONFIGURED";
};

export const sendWorkspaceInvitationEmail = async (
  to: string,
  subject: EmailSubject,
  data: WorkspaceInvitationEmailProps,
): Promise<EmailResult> => {
  if (!isSmtpConfigured()) {
    return { success: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  try {
    const email = await render(
      WorkspaceInvitationEmail({ instance: instanceHost(), ...data, to }),
      subject,
    );
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      ...email,
    });
    return { success: true };
  } catch (error) {
    console.error("Error sending workspace invitation email", error);
    throw error;
  }
};

export const sendNotificationEmail = async (
  to: string,
  subject: EmailSubject,
  data: NotificationEmailProps,
): Promise<EmailResult> => {
  if (!isSmtpConfigured()) {
    return { success: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  try {
    const email = await render(NotificationEmail(data), subject);
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      ...email,
    });
    return { success: true };
  } catch (error) {
    console.error("Error sending notification email", error);
    throw error;
  }
};

export const sendTrialReminderEmail = async (
  to: string,
  subject: EmailSubject,
  data: TrialReminderEmailProps,
) => {
  const email = await render(
    TrialReminderEmail({ email: to, ...data }),
    subject,
  );
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      ...email,
    });
  } catch (error) {
    console.error("Error sending trial reminder email", error);
  }
};

/**
 * Emails an administrator asks Kaneo to send. They report delivery so the
 * administrator can be told, and throw when the SMTP server rejects them.
 */
async function sendAdministratorEmail(
  kind: string,
  to: string,
  subject: EmailSubject,
  template: ReactElement,
): Promise<EmailResult> {
  if (!isSmtpConfigured()) {
    return { success: false, reason: "SMTP_NOT_CONFIGURED" };
  }
  try {
    const email = await render(template, subject);
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      ...email,
    });
    return { success: true };
  } catch (error) {
    console.error(`Error sending ${kind} email`, getSmtpErrorDetails(error));
    throw new Error(`The ${kind} email could not be sent`);
  }
}

export const sendAccountPasswordEmail = (
  to: string,
  subject: EmailSubject,
  data: AccountPasswordEmailProps,
) =>
  sendAdministratorEmail(
    "account password",
    to,
    subject,
    AccountPasswordEmail({ email: to, instance: instanceHost(), ...data }),
  );

export const sendEmailVerificationEmail = (
  to: string,
  subject: EmailSubject,
  data: EmailVerificationEmailProps,
) =>
  sendAdministratorEmail(
    "email verification",
    to,
    subject,
    EmailVerificationEmail({ email: to, instance: instanceHost(), ...data }),
  );

/**
 * Send the administrator's SMTP test. It throws the SMTP error itself so the
 * caller can tell the administrator what went wrong.
 */
export const sendTestEmail = async (
  to: string,
  subject: EmailSubject,
  data: Omit<TestEmailProps, "email" | "instance">,
): Promise<EmailResult> => {
  if (!isSmtpConfigured()) {
    return { success: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  const email = await render(
    TestEmail({ email: to, instance: instanceHost(), ...data }),
    subject,
  );
  const testTransport = nodemailer.createTransport({
    ...getSmtpTransportOptions(),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
  try {
    await testTransport.sendMail({
      from: process.env.SMTP_FROM,
      to,
      ...email,
    });
    return { success: true };
  } finally {
    testTransport.close();
  }
};
