import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  createCalendarFeed,
  getCalendarFeed,
  listCalendarFeeds,
  revokeCalendarFeed,
} from "./service";

const feedSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  token: v.string(),
  labelIds: v.array(v.string()),
  timeZone: v.string(),
  createdAt: v.date(),
});
const projectParam = v.object({ projectId: v.string() });
const sharePermission = requireWorkspacePermission({ project: ["share"] });

export const publicCalendarFeed = new Hono().get(
  "/:token/calendar.ics",
  describeRoute({
    operationId: "getCalendarFeed",
    tags: ["Calendar feeds"],
    description:
      "Subscribe to scheduled project tasks using a secret calendar feed link",
    security: [],
    responses: {
      200: {
        description: "iCalendar feed",
        content: { "text/calendar": { schema: { type: "string" } } },
      },
    },
  }),
  validator(
    "param",
    v.object({ token: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)) }),
  ),
  async (c) => {
    c.header("Cache-Control", "private, no-store");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Content-Type", "text/calendar; charset=utf-8");
    c.header("Content-Disposition", 'inline; filename="kaneo.ics"');
    return c.body(await getCalendarFeed(c.req.valid("param").token));
  },
);

const calendarFeed = new Hono<{
  Variables: { userId: string; workspaceId: string };
}>()
  .get(
    "/project/:projectId",
    describeRoute({
      operationId: "listCalendarFeeds",
      tags: ["Calendar feeds"],
      description:
        "List project calendar subscriptions (requires project sharing permission)",
      responses: {
        200: {
          description: "Calendar feeds",
          content: {
            "application/json": { schema: resolver(v.array(feedSchema)) },
          },
        },
      },
    }),
    validator("param", projectParam),
    workspaceAccess.fromProject("projectId"),
    sharePermission,
    async (c) => {
      c.header("Cache-Control", "private, no-store");
      return c.json(await listCalendarFeeds(c.req.valid("param").projectId));
    },
  )
  .post(
    "/project/:projectId",
    describeRoute({
      operationId: "createCalendarFeed",
      tags: ["Calendar feeds"],
      description: "Create a calendar subscription matching any selected label",
      responses: {
        201: {
          description: "Calendar feed created",
          content: { "application/json": { schema: resolver(feedSchema) } },
        },
      },
    }),
    validator("param", projectParam),
    validator(
      "json",
      v.object({
        labelIds: v.pipe(
          v.array(v.pipe(v.string(), v.minLength(1))),
          v.minLength(1),
          v.maxLength(100),
        ),
        timeZone: v.optional(
          v.pipe(
            v.string(),
            v.check((value) => {
              try {
                new Intl.DateTimeFormat("en-US", { timeZone: value });
                return true;
              } catch {
                return false;
              }
            }, "Invalid time zone"),
          ),
          "UTC",
        ),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    sharePermission,
    async (c) => {
      const { labelIds, timeZone } = c.req.valid("json");
      c.header("Cache-Control", "private, no-store");
      return c.json(
        await createCalendarFeed(
          c.req.valid("param").projectId,
          c.get("workspaceId"),
          labelIds,
          timeZone,
        ),
        201,
      );
    },
  )
  .delete(
    "/project/:projectId/:id",
    describeRoute({
      operationId: "revokeCalendarFeed",
      tags: ["Calendar feeds"],
      description: "Revoke a calendar subscription link",
      responses: {
        200: {
          description: "Calendar feed revoked",
          content: {
            "application/json": {
              schema: resolver(v.object({ success: v.boolean() })),
            },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string(), id: v.string() })),
    workspaceAccess.fromProject("projectId"),
    sharePermission,
    async (c) =>
      c.json(
        await revokeCalendarFeed(
          c.req.valid("param").projectId,
          c.req.valid("param").id,
        ),
      ),
  );

export default calendarFeed;
