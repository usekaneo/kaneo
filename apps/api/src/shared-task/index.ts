import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { HTTPException } from "hono/http-exception";
import {
  buildContentDisposition,
  isSafeInlineAssetType,
} from "../storage/asset-response";
import { getPrivateObject } from "../storage/s3";
import { descriptionPageSchema } from "../task/response";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  sharedTaskSchema,
  taskShareSchema,
  taskShareStateSchema,
} from "./response";
import {
  sharedTaskAssetParam,
  sharedTaskDescriptionQuery,
  sharedTaskTokenParam,
  taskShareTaskParam,
} from "./schema";
import {
  ensureTaskShare,
  getSharedTask,
  getSharedTaskDescriptionPage,
  getSharedTaskImage,
  getTaskShare,
  revokeTaskShare,
} from "./service";

function privateNoStore(headers: Headers) {
  headers.set("Cache-Control", "private, no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
}

export const publicSharedTask = apiRouter()
  .openapi(
    createRoute({
      method: "get",
      path: "/{token}",
      operationId: "getSharedTask",
      tags: ["Task sharing"],
      summary: "Read a shared task",
      description:
        "Read the current safe summary of a task using its secret share token. No authentication is required.",
      security: [],
      request: { params: sharedTaskTokenParam },
      responses: {
        200: jsonResponse("Shared task", sharedTaskSchema),
        404: errorResponse("Shared task not found or revoked"),
        503: errorResponse("Shared task request timed out"),
      },
    }),
    async (c) => {
      c.header("Cache-Control", "private, no-store");
      c.header("Referrer-Policy", "no-referrer");
      c.header("X-Content-Type-Options", "nosniff");
      return c.json(await getSharedTask(c.req.valid("param").token), 200);
    },
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/{token}/description",
      operationId: "getSharedTaskDescriptionPage",
      tags: ["Task sharing"],
      summary: "Read a shared task description page",
      security: [],
      request: {
        params: sharedTaskTokenParam,
        query: sharedTaskDescriptionQuery,
      },
      responses: {
        200: jsonResponse(
          "Shared task description page",
          descriptionPageSchema,
        ),
        400: errorResponse("Invalid description cursor"),
        404: errorResponse("Shared task not found or revoked"),
        409: errorResponse("Description changed while loading"),
        503: errorResponse("Description request timed out"),
      },
    }),
    async (c) => {
      c.header("Cache-Control", "private, no-store");
      c.header("Referrer-Policy", "no-referrer");
      c.header("X-Content-Type-Options", "nosniff");
      return c.json(
        await getSharedTaskDescriptionPage(
          c.req.valid("param").token,
          c.req.valid("query"),
        ),
        200,
      );
    },
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/{token}/asset/{assetId}",
      operationId: "getSharedTaskImage",
      tags: ["Task sharing"],
      summary: "Read an image from a shared task description",
      description:
        "Serves only safe inline images attached to the shared task description. Files and comment media remain private.",
      security: [],
      request: { params: sharedTaskAssetParam },
      responses: {
        200: {
          description: "The shared image binary stream",
          content: {
            "image/*": { schema: { type: "string", format: "binary" } },
          },
        },
        404: errorResponse("Shared image not found or revoked"),
      },
    }),
    async (c) => {
      const { token, assetId } = c.req.valid("param");
      const asset = await getSharedTaskImage(token, assetId);
      let object: Awaited<ReturnType<typeof getPrivateObject>>;
      try {
        object = await getPrivateObject(asset.objectKey);
      } catch {
        throw new HTTPException(404, { message: "Shared task not found" });
      }
      const contentType = (object.contentType || asset.mimeType)
        .toLowerCase()
        .split(";")[0]
        ?.trim();
      if (!contentType || !isSafeInlineAssetType(contentType)) {
        throw new HTTPException(404, { message: "Shared task not found" });
      }

      const headers = new Headers({
        "Content-Disposition": buildContentDisposition(asset.filename, true),
        "Content-Type": contentType,
      });
      privateNoStore(headers);
      if (object.contentLength !== undefined)
        headers.set("Content-Length", object.contentLength.toString());
      if (object.etag) headers.set("ETag", object.etag);
      if (object.lastModified)
        headers.set("Last-Modified", object.lastModified.toUTCString());
      return new Response(object.body as BodyInit, { headers });
    },
  );

const sharingMiddleware = [
  workspaceAccess.fromTaskId("taskId"),
  requireWorkspacePermission({ project: ["share"] }),
];

const managementErrors = {
  400: errorResponse("Invalid request or unknown task"),
  401: errorResponse("Authentication required"),
  403: errorResponse(
    "No workspace access or missing project sharing permission",
  ),
};

const taskShare = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(
    createRoute({
      method: "get",
      path: "/{taskId}",
      operationId: "getTaskShare",
      tags: ["Task sharing"],
      summary: "Get a task share link",
      middleware: sharingMiddleware,
      request: { params: taskShareTaskParam },
      responses: {
        200: jsonResponse("Task share state", taskShareStateSchema),
        ...managementErrors,
      },
    }),
    async (c) => {
      c.header("Cache-Control", "private, no-store");
      return c.json(await getTaskShare(c.req.valid("param").taskId), 200);
    },
  )
  .openapi(
    createRoute({
      method: "put",
      path: "/{taskId}",
      operationId: "ensureTaskShare",
      tags: ["Task sharing"],
      summary: "Create or return a task share link",
      middleware: sharingMiddleware,
      request: { params: taskShareTaskParam },
      responses: {
        200: jsonResponse("Active task share", taskShareSchema),
        409: errorResponse("Task share could not be created"),
        ...managementErrors,
      },
    }),
    async (c) => {
      c.header("Cache-Control", "private, no-store");
      return c.json(await ensureTaskShare(c.req.valid("param").taskId), 200);
    },
  )
  .openapi(
    createRoute({
      method: "delete",
      path: "/{taskId}",
      operationId: "revokeTaskShare",
      tags: ["Task sharing"],
      summary: "Revoke a task share link",
      middleware: sharingMiddleware,
      request: { params: taskShareTaskParam },
      responses: {
        200: jsonResponse(
          "Task share revoked",
          z.object({ success: z.boolean() }),
        ),
        ...managementErrors,
      },
    }),
    async (c) => {
      c.header("Cache-Control", "private, no-store");
      return c.json(await revokeTaskShare(c.req.valid("param").taskId), 200);
    },
  );

export default taskShare;
