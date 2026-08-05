import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import { externalLinkTable } from "../database/schema";
import { workspaceAccess } from "../utils/workspace-access-middleware";

const externalLinkSchema = v.object({
  id: v.string(),
  taskId: v.string(),
  integrationId: v.string(),
  resourceType: v.string(),
  externalId: v.string(),
  url: v.string(),
  title: v.nullable(v.string()),
  metadata: v.any(),
  createdAt: v.date(),
  updatedAt: v.date(),
});

const externalLink = new Hono<{
  Variables: {
    userId: string;
    workspaceId: string;
  };
}>().get(
  "/task/:taskId",
  describeRoute({
    operationId: "getExternalLinksByTask",
    tags: ["External Links"],
    description: "Get all external links for a task",
    responses: {
      200: {
        description: "External links for the task",
        content: {
          "application/json": {
            schema: resolver(v.array(externalLinkSchema)),
          },
        },
      },
    },
  }),
  validator("param", v.object({ taskId: v.string() })),
  workspaceAccess.fromTaskId("taskId"),
  async (c) => {
    const { taskId } = c.req.valid("param");

    const links = await db.query.externalLinkTable.findMany({
      where: eq(externalLinkTable.taskId, taskId),
      with: {
        // Never widen this: integration.config holds plaintext provider
        // secrets and this route is reachable by any workspace member.
        integration: { columns: { id: true, type: true } },
      },
    });

    const formattedLinks = links.map((link) => ({
      ...link,
      metadata: link.metadata ? JSON.parse(link.metadata) : null,
    }));

    return c.json(formattedLinks);
  },
);

export default externalLink;
