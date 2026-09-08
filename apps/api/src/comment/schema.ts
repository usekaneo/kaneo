import { z } from "../openapi";

export const taskIdParam = z.object({ taskId: z.string() });

export const commentParam = z.object({ id: z.string() });

export const createCommentBody = z.object({
  content: z.string().min(1),
  // Both or neither: a name without a source would render as an unattributed
  // impersonation of a real account.
  externalUserName: z.string().max(120).optional().openapi({
    description:
      "Attribution for an imported comment. Ignored unless externalSource is also given.",
  }),
  externalSource: z.enum(["planka", "trello", "jira"]).optional().openapi({
    description: "The tool the comment was imported from.",
  }),
});

export const updateCommentBody = z.object({ content: z.string().min(1) });
