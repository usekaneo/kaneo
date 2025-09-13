import { render } from "@react-email/components";
import { config } from "dotenv-mono";
import * as nodemailer from "nodemailer";
import MagicLinkEmail from "./templates/magic-link";
import type { MagicLinkEmailProps } from "./templates/magic-link";
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
});

// TODO: Fix me
export const sendMagicLinkEmail = async (
  to: string,
  subject: string,
  data: MagicLinkEmailProps,
) => {
  const emailTemplate = await render(MagicLinkEmail(data));
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: "delivered@resend.dev",
    subject,
    html: emailTemplate,
  });
};

// TODO: Fix me
export const sendWorkspaceInvitationEmail = async (
  to: string,
  subject: string,
  data: WorkspaceInvitationEmailProps,
) => {
  const emailTemplate = await render(WorkspaceInvitationEmail(data));
  await transporter.sendMail({
    from: "onboarding@resend.dev",
    to: "delivered@resend.dev",
    subject: "Hello World",
    html: emailTemplate,
  });
};
