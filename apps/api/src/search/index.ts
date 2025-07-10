import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import globalSearch from "./controllers/global-search";

const search = new Hono<{
  Variables: {
    userEmail: string;
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
    }),
  ),
  async (c) => {
    const { q, type, workspaceId, projectId, limit } = c.req.valid("query");
    const userEmail = c.get("userEmail");

    const results = await globalSearch({
      query: q,
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
