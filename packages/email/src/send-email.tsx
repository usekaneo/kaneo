import { render } from "@react-email/components";
import * as nodemailer from "nodemailer";
import MagicLinkEmail from "./templates/magic-link";
import type { MagicLinkEmailProps } from "./templates/magic-link";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE !== "false",
  ...(process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD && {
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    }),
});

export const sendMagicLinkEmail = async (
  to: string,
  subject: string,
  data: MagicLinkEmailProps,
) => {
  const emailTemplate = await render(MagicLinkEmail(data));
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html: emailTemplate,
  });
};
