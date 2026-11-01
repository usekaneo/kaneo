import { z } from "../openapi";

export const taskIdParam = z.object({ taskId: z.string() });

// The URL is rendered as a link href, so schemes that run script or reach
// local content are rejected. Any other scheme is allowed so links can open
// desktop apps (obsidian://, vscode://, ...).
const blockedSchemes = ["javascript:", "data:", "vbscript:", "file:", "blob:"];

function hasAllowedScheme(value: string) {
  try {
    return !blockedSchemes.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export const createExternalLinkBody = z.object({
  url: z
    .string()
    .url()
    .refine(hasAllowedScheme, "URL scheme is not allowed")
    .describe(
      "A URL, such as an HTTPS link or an app link like obsidian://. javascript:, data:, vbscript:, file: and blob: URLs are rejected.",
    ),
  title: z.string().max(200).optional(),
});

export const deleteExternalLinkParam = taskIdParam.extend({ id: z.string() });
