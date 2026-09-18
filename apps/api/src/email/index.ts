import { emailProvider } from "@kaneo/email";
import { and, desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { emailOutboxTable } from "../database/schema";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  nullableResponseTimestamp,
  responseTimestamp,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { retryEmail } from "./outbox";

const tags = ["Email"];
const admin = requireWorkspacePermission({ workspace: ["manage_settings"] });

const logEntrySchema = z
  .object({
    id: z.string(),
    toEmail: z.string(),
    subject: z.string(),
    category: z.string(),
    status: z
      .string()
      .openapi({ description: "queued, sending, sent or failed" }),
    attempts: z.number(),
    lastError: z.string().nullable(),
    createdAt: responseTimestamp,
    sentAt: nullableResponseTimestamp,
  })
  .openapi("EmailLogEntry");

const logSchema = z
  .object({
    provider: z
      .enum(["resend", "smtp"])
      .nullable()
      .openapi({
        description: "How this instance sends email; null when it can't.",
      }),
    entries: z.array(logEntrySchema),
  })
  .openapi("EmailLog");

const listRoute = createRoute({
  method: "get",
  operationId: "listEmailLog",
  path: "/",
  tags,
  summary: "Email delivery log",
  description:
    "The latest emails sent to this workspace's members, with their delivery status. Bodies are never returned. Needs workspace:manage_settings.",
  middleware: [workspaceAccess.fromQuery(), admin] as const,
  request: {
    query: z.object({
      workspaceId: z.string(),
      status: z.enum(["queued", "sending", "sent", "failed"]).optional(),
    }),
  },
  responses: {
    200: jsonResponse("Log", logSchema),
    403: errorResponse("Missing workspace:manage_settings"),
  },
});

const retryRoute = createRoute({
  method: "post",
  operationId: "retryEmail",
  path: "/{id}/retry",
  tags,
  summary: "Send a failed email again",
  middleware: [workspaceAccess.fromBody(), admin] as const,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      required: true,
      content: {
        "application/json": { schema: z.object({ workspaceId: z.string() }) },
      },
    },
  },
  responses: {
    200: jsonResponse("Queued again", z.object({ id: z.string() })),
    404: errorResponse("No failed email with that id in the workspace"),
  },
});

const emailLog = apiRouter()
  .openapi(listRoute, async (c) => {
    const { workspaceId, status } = c.req.valid("query");
    const entries = await db
      .select({
        id: emailOutboxTable.id,
        toEmail: emailOutboxTable.toEmail,
        subject: emailOutboxTable.subject,
        category: emailOutboxTable.category,
        status: emailOutboxTable.status,
        attempts: emailOutboxTable.attempts,
        lastError: emailOutboxTable.lastError,
        createdAt: emailOutboxTable.createdAt,
        sentAt: emailOutboxTable.sentAt,
      })
      .from(emailOutboxTable)
      .where(
        and(
          eq(emailOutboxTable.workspaceId, workspaceId),
          status ? eq(emailOutboxTable.status, status) : undefined,
        ),
      )
      .orderBy(desc(emailOutboxTable.createdAt))
      .limit(200);
    return c.json({ provider: emailProvider(), entries }, 200);
  })
  .openapi(retryRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { workspaceId } = c.req.valid("json");
    if (!(await retryEmail(workspaceId, id))) {
      throw new HTTPException(404, { message: "No failed email to retry" });
    }
    return c.json({ id }, 200);
  });

export default emailLog;
