import { isValidElement, type ReactElement } from "react";
import { z } from "zod";
import {
  emailAttachmentSchema,
  MAX_EMAIL_ATTACHMENT_BYTES,
} from "./attachment";
import type { SendingIdentity } from "./sender";

const headerValue = z
  .string()
  .regex(/^[^\r\n\0]*$/, "Email headers cannot contain line breaks or NUL");
const mailbox = headerValue.min(1);
const attachments = z
  .array(emailAttachmentSchema)
  .refine(
    (files) =>
      files.reduce((total, file) => total + file.content.byteLength, 0) <=
      MAX_EMAIL_ATTACHMENT_BYTES,
    "Total email attachments exceed the byte limit",
  );

// These schemas validate shape, not authority: parsing never mints a sender or recipient brand.
export const emailInputSchema = z.object({
  from: mailbox.optional(),
  to: z.email(),
  subject: headerValue,
  html: z.string().optional(),
  react: z
    .custom<ReactElement>(isValidElement, "Expected a React element")
    .optional(),
  text: z.string().optional(),
  replyTo: mailbox.optional(),
  messageId: headerValue.min(1).optional(),
  inReplyTo: headerValue.min(1).optional(),
  references: z.array(headerValue.min(1)).optional(),
  extraHeaders: z
    .record(z.string().regex(/^[!-9;-~]+$/), headerValue)
    .optional(),
  emailType: z.string().optional(),
  preview: z.record(z.string(), z.unknown()).optional(),
  fromDisplayName: headerValue.optional(),
  conversationId: z.string().nullable().optional(),
  ticketId: z.string().nullable().optional(),
  postId: z.string().nullable().optional(),
  attachments: attachments.optional(),
});

export type EmailInput = z.infer<typeof emailInputSchema>;
export type DispatchOptions = Omit<EmailInput, "from"> & {
  from?: SendingIdentity;
};
export type TemplateEmailOptions = Omit<
  DispatchOptions,
  "html" | "text" | "react"
> & { react: ReactElement };

export const rawEmailInputSchema = emailInputSchema
  .pick({
    from: true,
    to: true,
    subject: true,
    html: true,
    text: true,
    replyTo: true,
    messageId: true,
    inReplyTo: true,
    references: true,
    extraHeaders: true,
    attachments: true,
  })
  .extend({ from: mailbox, html: z.string() });

export type RawEmailOptions = Omit<
  z.infer<typeof rawEmailInputSchema>,
  "from"
> & { from: SendingIdentity };
