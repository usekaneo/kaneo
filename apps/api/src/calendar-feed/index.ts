import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import {
  hasWorkspacePermission,
  requireWorkspacePermission,
} from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { calendarFeedSchema } from "./response";
import {
  calendarFeedDeleteParam,
  calendarFeedProjectParam,
  calendarFeedTokenParam,
  createCalendarFeedBody,
} from "./schema";
import {
  createCalendarFeed,
  getCalendarFeed,
  listCalendarFeeds,
  revokeCalendarFeed,
} from "./service";

const sharingMiddleware = [
  workspaceAccess.fromProject("projectId"),
  requireWorkspacePermission({ project: ["share"] }),
];
const managementErrors = {
  400: errorResponse("Invalid request or unknown project"),
  401: errorResponse("Authentication required"),
  403: errorResponse(
    "No workspace access or missing project sharing permission",
  ),
};

export const publicCalendarFeed = apiRouter().openapi(
  createRoute({
    method: "get",
    path: "/{token}/calendar.ics",
    operationId: "getCalendarFeed",
    tags: ["Calendar feeds"],
    summary: "Subscribe to a calendar feed",
    description:
      "Read scheduled project tasks using a secret calendar feed link. Anyone with the link can read matching task titles, descriptions, and dates. Responses are streamed; descriptions longer than 4096 characters and titles or calendar names longer than 1024 characters are truncated with an ellipsis.",
    security: [],
    request: { params: calendarFeedTokenParam },
    responses: {
      200: {
        description: "iCalendar feed",
        content: { "text/calendar": { schema: z.string() } },
      },
      400: errorResponse("Invalid feed token"),
      404: errorResponse("Calendar feed not found or revoked"),
    },
  }),
  async (c) => {
    c.header("Cache-Control", "private, no-store");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Content-Type", "text/calendar; charset=utf-8");
    c.header("Content-Disposition", 'inline; filename="kaneo.ics"');
    return c.body(await getCalendarFeed(c.req.valid("param").token), 200);
  },
);

const calendarFeed = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(
    createRoute({
      method: "get",
      path: "/project/{projectId}",
      operationId: "listCalendarFeeds",
      tags: ["Calendar feeds"],
      summary: "List project calendar feeds",
      description:
        "List secret calendar subscription links. Requires project sharing permission.",
      middleware: sharingMiddleware,
      request: { params: calendarFeedProjectParam },
      responses: {
        200: jsonResponse("Calendar feeds", z.array(calendarFeedSchema)),
        ...managementErrors,
      },
    }),
    async (c) => {
      c.header("Cache-Control", "private, no-store");
      return c.json(
        await listCalendarFeeds(c.req.valid("param").projectId),
        200,
      );
    },
  )
  .openapi(
    createRoute({
      method: "post",
      path: "/project/{projectId}",
      operationId: "createCalendarFeed",
      tags: ["Calendar feeds"],
      summary: "Create a calendar feed",
      description:
        "Create a calendar subscription matching any selected label. Tasks need a start or due date. All-day dates use the supplied time zone. Creating a missing workspace label definition also requires label:create permission.",
      middleware: sharingMiddleware,
      request: {
        params: calendarFeedProjectParam,
        body: {
          required: true,
          content: { "application/json": { schema: createCalendarFeedBody } },
        },
      },
      responses: {
        201: jsonResponse("Calendar feed created", calendarFeedSchema),
        ...managementErrors,
        403: errorResponse(
          "No workspace access, missing project:share permission, or missing label:create permission for a new workspace label definition",
        ),
      },
    }),
    async (c) => {
      const { labelIds, timeZone } = c.req.valid("json");
      c.header("Cache-Control", "private, no-store");
      return c.json(
        await createCalendarFeed(
          c.req.valid("param").projectId,
          c.get("workspaceId"),
          labelIds,
          timeZone,
          await hasWorkspacePermission(c, { label: ["create"] }),
        ),
        201,
      );
    },
  )
  .openapi(
    createRoute({
      method: "delete",
      path: "/project/{projectId}/{id}",
      operationId: "revokeCalendarFeed",
      tags: ["Calendar feeds"],
      summary: "Revoke a calendar feed",
      description:
        "Revoke a calendar subscription link, preventing further access through it.",
      middleware: sharingMiddleware,
      request: { params: calendarFeedDeleteParam },
      responses: {
        200: jsonResponse(
          "Calendar feed revoked",
          z.object({ success: z.boolean() }),
        ),
        404: errorResponse("Calendar feed not found in this project"),
        ...managementErrors,
      },
    }),
    async (c) =>
      c.json(
        await revokeCalendarFeed(
          c.req.valid("param").projectId,
          c.req.valid("param").id,
        ),
        200,
      ),
  );

export default calendarFeed;
