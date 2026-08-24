import { responseTimestamp, z } from "../openapi";

// The list route joins the author; the mutation routes return the raw activity
// row, which carries no author object. See activity/response.ts.
export const commentSchema = z
  .object({
    id: z.string(),
    taskId: z.string(),
    userId: z.string(),
    content: z.string(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
    user: z
      .object({ name: z.string(), image: z.string().nullable() })
      .openapi("CommentAuthor"),
  })
  .openapi("Comment");

export const commentListSchema = z.array(commentSchema);
