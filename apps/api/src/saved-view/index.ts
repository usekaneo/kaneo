import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { resolvedSavedViewSchema, savedViewSchema } from "../schemas";
import { hasWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import listSavedViews from "./controllers/list-saved-views";
import upsertSavedView from "./controllers/upsert-saved-view";

const savedViewKeySchema = v.pipe(
  v.string(),
  v.regex(/^[a-z][a-z0-9-]{1,31}$/),
);
const savedViewNameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(64),
);
const viewTypeSchema = v.picklist(["board", "list", "gantt"] as const);
const configurationSchema = v.pipe(
  v.unknown(),
  v.check(
    (configuration) =>
      typeof configuration === "object" &&
      configuration !== null &&
      !Array.isArray(configuration),
  ),
  v.record(v.string(), v.unknown()),
);

const savedView = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .post(
    "/",
    describeRoute({
      operationId: "upsertSavedView",
      tags: ["Saved Views"],
      description: "Create or update a saved view in the same scope",
      responses: {
        200: {
          description: "Saved view created or updated successfully",
          content: {
            "application/json": { schema: resolver(savedViewSchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        workspaceId: v.string(),
        projectId: v.optional(v.nullable(v.string())),
        userId: v.optional(v.nullable(v.string())),
        key: savedViewKeySchema,
        name: savedViewNameSchema,
        type: viewTypeSchema,
        position: v.pipe(v.number(), v.integer()),
        enabled: v.boolean(),
        configuration: configurationSchema,
      }),
    ),
    workspaceAccess.fromBody(),
    async (c) => {
      const input = c.req.valid("json");
      const authenticatedUserId = c.get("userId");

      if (input.userId && input.userId !== authenticatedUserId) {
        throw new HTTPException(403, {
          message: "Personal saved views can only belong to the current user",
        });
      }

      if (
        !input.userId &&
        !(await hasWorkspacePermission(c, { saved_view: ["update"] }))
      ) {
        throw new HTTPException(403, { message: "Insufficient permissions" });
      }

      return c.json(await upsertSavedView(input));
    },
  )
  .get(
    "/workspace/:workspaceId/project/:projectId",
    describeRoute({
      operationId: "listSavedViews",
      tags: ["Saved Views"],
      description: "List resolved saved views for a project",
      responses: {
        200: {
          description: "Enabled saved views resolved by scope precedence",
          content: {
            "application/json": {
              schema: resolver(v.array(resolvedSavedViewSchema)),
            },
          },
        },
      },
    }),
    validator(
      "param",
      v.object({ workspaceId: v.string(), projectId: v.string() }),
    ),
    workspaceAccess.fromParam(),
    async (c) => {
      const { workspaceId, projectId } = c.req.valid("param");
      return c.json(
        await listSavedViews(workspaceId, projectId, c.get("userId")),
      );
    },
  );

export default savedView;
