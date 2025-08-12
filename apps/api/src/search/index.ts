import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import globalSearch from "./controllers/global-search";

const search = new Hono<{
  Variables: {
    userId: string;
  };
}>().get(
  "/",
  zValidator(
    "query",
    z.object({
      q: z.string().min(1),
      type: z
        .enum([
          "all",
          "tasks",
          "projects",
          "workspaces",
          "comments",
          "activities",
        ])
        .optional()
        .default("all"),
      workspaceId: z.string().optional(),
      projectId: z.string().optional(),
      limit: z.coerce.number().min(1).max(50).optional().default(20),
      userEmail: z.email().optional(),
    }),
  ),
  async (c) => {
    const { q, type, workspaceId, projectId, limit, userEmail } =
      c.req.valid("query");
    const userId = c.get("userId");

    const results = await globalSearch({
      query: q,
      userId,
      userEmail,
      type,
      workspaceId,
      projectId,
      limit,
    });

    return c.json(results);
  },
);

export default search;
