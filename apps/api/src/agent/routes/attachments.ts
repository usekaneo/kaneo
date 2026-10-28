import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../../openapi";
import { boundedRequestBody } from "../../utils/bounded-request-body";
import { buildContentDisposition } from "../../utils/build-content-disposition";
import { getAttachmentContent } from "../controllers/get-attachment-content";
import { uploadAttachment } from "../controllers/upload-attachment";
import { attachmentResponse } from "../response";
import {
  AGENT_ATTACHMENT_LIMITS,
  AGENT_UPLOAD_REQUEST_BYTES,
  attachmentParams,
  uploadAttachmentSchema,
  workspaceParams,
} from "../schema";
import { errors, middleware, mutationMiddleware } from "./common";

const routes = apiRouter()
  .openapi(
    createRoute({
      method: "post",
      path: "/{workspaceId}/attachments",
      operationId: "uploadAgentAttachment",
      tags: ["Agent"],
      summary: "Upload an image or PDF for a run",
      description: `Stores a PNG, JPEG, WebP, GIF, or PDF of up to ${AGENT_ATTACHMENT_LIMITS.bytesPerUpload / (1024 * 1024)} MB for you to reference in one run's attachments. Unsent uploads expire after a day; at most ${AGENT_ATTACHMENT_LIMITS.pendingUploads} can be pending per user.`,
      middleware: [
        ...mutationMiddleware,
        boundedRequestBody(AGENT_UPLOAD_REQUEST_BYTES, 60_000),
      ] as const,
      request: {
        params: workspaceParams,
        body: {
          required: true,
          content: { "application/json": { schema: uploadAttachmentSchema } },
        },
      },
      responses: {
        201: jsonResponse("Stored upload", attachmentResponse),
        ...errors,
        400: errorResponse("Invalid file data or type"),
        408: errorResponse("Request body timed out"),
        413: errorResponse("Request body exceeds the upload limit"),
        429: errorResponse("Too many unsent uploads or agent run limit"),
      },
    }),
    async (c) =>
      c.json(
        await uploadAttachment(
          {
            userId: c.get("userId"),
            workspaceId: c.req.valid("param").workspaceId,
            projectId: null,
          },
          c.req.valid("json"),
        ),
        201,
      ),
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/{workspaceId}/attachments/{attachmentId}/content",
      operationId: "getAgentAttachmentContent",
      tags: ["Agent"],
      summary: "Download one of your run attachments",
      description:
        "Only the uploader can read it. Images are served inline, PDFs as downloads.",
      middleware,
      request: { params: attachmentParams },
      responses: {
        200: {
          description: "The attachment bytes",
          content: {
            "image/*": { schema: { type: "string", format: "binary" } },
            "application/pdf": {
              schema: { type: "string", format: "binary" },
            },
          },
        },
        ...errors,
      },
    }),
    async (c) => {
      const { workspaceId, attachmentId } = c.req.valid("param");
      const attachment = await getAttachmentContent(
        { userId: c.get("userId"), workspaceId, projectId: null },
        attachmentId,
      );
      const inline = attachment.mediaType.startsWith("image/");
      return new Response(new Uint8Array(attachment.data), {
        headers: {
          "Cache-Control": "private, max-age=3600",
          "Content-Disposition": buildContentDisposition(
            attachment.name,
            inline,
          ),
          "Content-Length": attachment.size.toString(),
          "Content-Security-Policy": "default-src 'none'; sandbox",
          "Content-Type": attachment.mediaType,
          "X-Content-Type-Options": "nosniff",
        },
      });
    },
  );
export default routes;
