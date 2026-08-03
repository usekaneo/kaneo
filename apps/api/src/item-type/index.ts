import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { itemTypeSchema } from "../schemas";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import archiveItemType from "./controllers/archive-item-type";
import createItemType from "./controllers/create-item-type";
import listItemTypes from "./controllers/list-item-types";
import updateItemType from "./controllers/update-item-type";

const itemTypeKeySchema = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{1,31}$/));
const itemTypeNameSchema = v.pipe(v.string(), v.trim(), v.minLength(1));

const itemType = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .get(
    "/workspace/:workspaceId",
    describeRoute({
      operationId: "listItemTypes",
      tags: ["Item Types"],
      description: "List active item types for a workspace",
      responses: {
        200: {
          description: "Active item types in display order",
          content: {
            "application/json": { schema: resolver(v.array(itemTypeSchema)) },
          },
        },
      },
    }),
    validator("param", v.object({ workspaceId: v.string() })),
    workspaceAccess.fromParam(),
    async (c) => {
      const { workspaceId } = c.req.valid("param");
      return c.json(await listItemTypes(workspaceId));
    },
  )
  .post(
    "/",
    describeRoute({
      operationId: "createItemType",
      tags: ["Item Types"],
      description: "Create an item type in a workspace",
      responses: {
        200: {
          description: "Item type created successfully",
          content: { "application/json": { schema: resolver(itemTypeSchema) } },
        },
      },
    }),
    validator(
      "json",
      v.object({
        workspaceId: v.string(),
        key: itemTypeKeySchema,
        name: itemTypeNameSchema,
        icon: v.optional(v.string()),
        description: v.optional(v.nullable(v.string())),
        position: v.optional(v.pipe(v.number(), v.integer())),
      }),
    ),
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ item_type: ["create"] }),
    async (c) => c.json(await createItemType(c.req.valid("json"))),
  )
  .put(
    "/:id",
    describeRoute({
      operationId: "updateItemType",
      tags: ["Item Types"],
      description: "Update an item type",
      responses: {
        200: {
          description: "Item type updated successfully",
          content: { "application/json": { schema: resolver(itemTypeSchema) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        key: itemTypeKeySchema,
        name: itemTypeNameSchema,
        icon: v.string(),
        description: v.nullable(v.string()),
        position: v.pipe(v.number(), v.integer()),
      }),
    ),
    workspaceAccess.fromItemType(),
    requireWorkspacePermission({ item_type: ["update"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      return c.json(await updateItemType(id, c.req.valid("json")));
    },
  )
  .delete(
    "/:id",
    describeRoute({
      operationId: "archiveItemType",
      tags: ["Item Types"],
      description: "Archive an item type",
      responses: {
        200: {
          description: "Item type archived successfully",
          content: { "application/json": { schema: resolver(itemTypeSchema) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromItemType(),
    requireWorkspacePermission({ item_type: ["delete"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      return c.json(await archiveItemType(id));
    },
  );

export default itemType;
