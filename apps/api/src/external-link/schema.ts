import { z } from "../openapi";

export const taskIdParam = z.object({ taskId: z.string() });

export const pullRequestMetadata = z
  .object({
    state: z.enum(["open", "closed"]),
    merged: z.boolean().default(false),
    draft: z.boolean().default(false),
  })
  .openapi("PullRequestLinkMetadata", {
    description:
      "Pull request status shown on the task: open, draft, merged or closed.",
  });

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

export const createExternalLinkBody = z
  .object({
    url: z
      .string()
      .url()
      .refine(hasAllowedScheme, "URL scheme is not allowed")
      .describe(
        "A URL, such as an HTTPS link or an app link like obsidian://. Pull request links must use HTTP or HTTPS. javascript:, data:, vbscript:, file: and blob: URLs are rejected.",
      ),
    title: z.string().max(200).optional(),
    resourceType: z
      .enum(["url", "pull_request"])
      .default("url")
      .describe(
        "`url` for a resource link, or `pull_request` to show the link as a pull request with its status",
      ),
    metadata: pullRequestMetadata
      .optional()
      .describe("Pull request status. Only accepted for `pull_request` links."),
  })
  .refine(
    ({ url, resourceType }) =>
      resourceType !== "pull_request" || /^https?:\/\//i.test(url),
    { path: ["url"], message: "Pull request links must use HTTP or HTTPS" },
  );

export const updateExternalLinkBody = z
  .object({
    title: z.string().max(200).optional(),
    metadata: pullRequestMetadata
      .optional()
      .describe("Pull request status. Only accepted for `pull_request` links."),
  })
  .refine((body) => body.title !== undefined || body.metadata !== undefined, {
    message: "Provide a title or metadata to update",
  });

export const deleteExternalLinkParam = taskIdParam.extend({ id: z.string() });
