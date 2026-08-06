import { render } from "@react-email/components";
import { config } from "dotenv-mono";
import * as nodemailer from "nodemailer";
import type { MagicLinkEmailProps } from "./templates/magic-link";
import MagicLinkEmail from "./templates/magic-link";
import NotificationEmail, {
  type NotificationEmailProps,
} from "./templates/notification";
import type { OtpEmailProps } from "./templates/otp";
import OtpEmail from "./templates/otp";
import PasswordResetEmail, {
  type PasswordResetEmailProps,
} from "./templates/password-reset";
import WorkspaceInvitationEmail, {
  type WorkspaceInvitationEmailProps,
} from "./templates/workspace-invitation";

config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  secure: process.env.SMTP_SECURE !== "false",
  port: Number(process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  requireTLS: process.env.SMTP_REQUIRE_TLS === "true",
  ignoreTLS: process.env.SMTP_IGNORE_TLS === "true",
});

export const sendMagicLinkEmail = async (
  to: string,
  subject: string,
  data: MagicLinkEmailProps,
) => {
  const emailTemplate = await render(MagicLinkEmail(data));
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html: emailTemplate,
    });
  } catch (error) {
    console.error("Error sending magic link email", error);
  }
};

export const sendOtpEmail = async (
  to: string,
  subject: string,
  data: OtpEmailProps,
) => {
  const emailTemplate = await render(OtpEmail(data));
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html: emailTemplate,
    });
  } catch (error) {
    console.error("Error sending OTP email", error);
  }
};

export const sendPasswordResetEmail = async (
  to: string,
  subject: string,
  data: PasswordResetEmailProps,
) => {
  const emailTemplate = await render(PasswordResetEmail(data));
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html: emailTemplate,
    });
  } catch (error) {
    console.error("Error sending password reset email", error);
  }
};

export type EmailResult = {
  success: boolean;
  reason?: "SMTP_NOT_CONFIGURED";
};

export const sendWorkspaceInvitationEmail = async (
  to: string,
  subject: string,
  data: WorkspaceInvitationEmailProps,
): Promise<EmailResult> => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
    return { success: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  try {
    const emailTemplate = await render(
      WorkspaceInvitationEmail({ ...data, to }),
    );
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html: emailTemplate,
    });
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
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
    return { success: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  try {
    const emailTemplate = await render(NotificationEmail(data));
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html: emailTemplate,
    });
    return { success: true };
  } catch (error) {
    console.error("Error sending notification email", error);
    throw error;
  }
};
