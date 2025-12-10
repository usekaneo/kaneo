import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import globalSearch from "./controllers/global-search";

const search = new Hono<{
  Variables: {
    userId: string;
  };
}>().get(
  "/",
  describeRoute({
    operationId: "globalSearch",
    tags: ["Search"],
    description:
      "Search across tasks, projects, workspaces, comments, and activities",
    responses: {
      200: {
        description: "Search results",
        content: {
          "application/json": { schema: resolver(v.any()) },
        },
      },
    },
  }),
  validator(
    "query",
    v.object({
      q: v.string([v.minLength(1)]),
      type: v.optional(
        v.picklist([
          "all",
          "tasks",
          "projects",
          "workspaces",
          "comments",
          "activities",
        ]),
        "all",
      ),
      workspaceId: v.optional(v.string()),
      projectId: v.optional(v.string()),
      limit: v.optional(
        v.pipe(
          v.string(),
          v.transform(Number),
          v.number([v.minValue(1), v.maxValue(50)]),
        ),
        "20",
      ),
      userEmail: v.optional(v.pipe(v.string(), v.email())),
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
      limit: typeof limit === "string" ? Number(limit) : limit,
    });

    return c.json(results);
  },
);

export default search;
