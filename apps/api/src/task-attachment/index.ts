import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  responseTimestamp,
  z,
} from "../openapi";
import {
  hasWorkspacePermission,
  requireWorkspacePermission,
} from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  attachFile,
  attachLink,
  findTaskAttachment,
  listAttachments,
  removeAttachment,
} from "./controllers";

const tags = ["Task attachments"];
const taskIdParam = z.object({ taskId: z.string() });
const json = <T>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});

const attachmentSchema = z
  .object({
    id: z.string(),
    taskId: z.string(),
    kind: z.enum(["file", "link"]),
    title: z.string(),
    url: z.string().nullable().openapi({ description: "Set for links." }),
    fileId: z.string().nullable().openapi({
      description:
        "Set for files: download it through the Files API (`/files/{id}/download`).",
    }),
    mimeType: z.string().nullable(),
    size: z.number().nullable(),
    uploadedBy: z.string().nullable(),
    createdBy: z.string().nullable(),
    createdByName: z.string().nullable(),
    createdAt: responseTimestamp,
  })
  .openapi("TaskAttachment");

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "Only http and https links are allowed",
  });

const editGuard = requireWorkspacePermission({ task: ["update"] });

const listRoute = createRoute({
  method: "get",
  operationId: "listTaskAttachments",
  path: "/{taskId}",
  tags,
  summary: "List a task's files and links",
  description: "Newest first.",
  middleware: [workspaceAccess.fromTaskId("taskId")] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("Attachments", z.array(attachmentSchema)),
    403: errorResponse("No access to the task's workspace"),
  },
});

const attachFileRoute = createRoute({
  method: "post",
  operationId: "attachTaskFile",
  path: "/{taskId}/file",
  tags,
  summary: "Attach a file",
  description:
    "Attach a file already uploaded to the workspace Files library (`PUT /files/upload`).",
  middleware: [workspaceAccess.fromTaskId("taskId"), editGuard] as const,
  request: {
    params: taskIdParam,
    body: json(z.object({ fileId: z.string() })),
  },
  responses: {
    200: jsonResponse("The attachment", attachmentSchema),
    400: errorResponse("Unknown file"),
    403: errorResponse("Missing task:update"),
  },
});

const attachLinkRoute = createRoute({
  method: "post",
  operationId: "attachTaskLink",
  path: "/{taskId}/link",
  tags,
  summary: "Add a link",
  description:
    "Without a title, the page's own title is used, or else the host name.",
  middleware: [workspaceAccess.fromTaskId("taskId"), editGuard] as const,
  request: {
    params: taskIdParam,
    body: json(
      z.object({
        url: httpUrl,
        title: z.string().trim().max(200).optional(),
      }),
    ),
  },
  responses: {
    200: jsonResponse("The attachment", attachmentSchema),
    400: errorResponse("Not an http(s) link"),
    403: errorResponse("Missing task:update"),
  },
});

const removeRoute = createRoute({
  method: "delete",
  operationId: "removeTaskAttachment",
  path: "/{taskId}/{id}",
  tags,
  summary: "Remove a file or link",
  description:
    "A removed file is deleted from the Files library too, so it needs the uploader or file:manage.",
  middleware: [workspaceAccess.fromTaskId("taskId"), editGuard] as const,
  request: { params: taskIdParam.extend({ id: z.string() }) },
  responses: {
    200: jsonResponse("Removed", z.object({ id: z.string() })),
    403: errorResponse("Missing task:update, or not your file"),
    404: errorResponse("Not found"),
  },
});

const taskAttachment = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listRoute, async (c) =>
    c.json(
      (await listAttachments(c.req.valid("param").taskId)) as z.infer<
        typeof attachmentSchema
      >[],
      200,
    ),
  )
  .openapi(attachFileRoute, async (c) => {
    const attachment = await attachFile({
      taskId: c.req.valid("param").taskId,
      workspaceId: c.get("workspaceId"),
      userId: c.get("userId"),
      fileId: c.req.valid("json").fileId,
    });
    return c.json(attachment as z.infer<typeof attachmentSchema>, 200);
  })
  .openapi(attachLinkRoute, async (c) => {
    const { url, title } = c.req.valid("json");
    const attachment = await attachLink({
      taskId: c.req.valid("param").taskId,
      workspaceId: c.get("workspaceId"),
      userId: c.get("userId"),
      url,
      title,
    });
    return c.json(attachment as z.infer<typeof attachmentSchema>, 200);
  })
  .openapi(removeRoute, async (c) => {
    const { taskId, id } = c.req.valid("param");
    const attachment = await findTaskAttachment(taskId, id);
    if (
      attachment.kind === "file" &&
      attachment.uploadedBy !== c.get("userId") &&
      !(await hasWorkspacePermission(c, { file: ["manage"] }))
    ) {
      throw new HTTPException(403, {
        message: "Only the person who uploaded it, or an admin, can do that",
      });
    }
    await removeAttachment(c.get("workspaceId"), c.get("userId"), attachment);
    return c.json({ id }, 200);
  });

export default taskAttachment;
