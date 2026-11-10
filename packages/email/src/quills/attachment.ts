/**
 * Real file attachments carried on an outbound email.
 *
 * One shape, handed to whichever transport is active (SES, SMTP, console) by
 * `dispatch` in index.ts. This module owns nothing about where the bytes come
 * from — the caller already loaded them (and decided which files were worth
 * loading) before an attachment reaches here.
 */
import { z } from "zod";

export const emailAttachmentSchema = z.object({
  filename: z
    .string()
    .min(1)
    .regex(/^[^\r\n\0]*$/),
  contentType: z
    .string()
    .min(1)
    .regex(/^[^\r\n\0]*$/),
  content: z.instanceof(Uint8Array),
});

export type EmailAttachment = z.infer<typeof emailAttachmentSchema>;

/**
 * Total attachment bytes a single outbound email may carry.
 *
 * Comfortably under the provider's standing 40 MB message-size ceiling even
 * after the roughly one-third inflation base64 encoding adds, with headroom
 * left for the rendered body. A file that does not fit this budget (or whose
 * bytes fail to load) is a caller's job to link in the body instead of
 * inlining — this package only ever sends what it is given.
 */
export const MAX_EMAIL_ATTACHMENT_BYTES = 10 * 1024 * 1024;
