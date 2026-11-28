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

export const createExternalLinkBody = z.object({
  url: z
    .string()
    .url()
    .refine((url) => /^https?:\/\//i.test(url), "URL must use http or https")
    .describe("An HTTP or HTTPS URL"),
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
});

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
