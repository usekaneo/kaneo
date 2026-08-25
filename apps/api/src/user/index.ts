import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { MAX_AVATAR_BYTES } from "./avatar";
import deleteAvatar from "./controllers/delete-avatar";
import saveAvatar from "./controllers/save-avatar";
import { avatarDeletedSchema, avatarSchema } from "./response";
import { uploadAvatarBody } from "./schema";

const uploadAvatarRoute = createRoute({
  method: "put",
  operationId: "uploadUserAvatar",
  path: "/avatar",
  tags: ["User"],
  summary: "Upload avatar",
  description: `Store a base64 encoded avatar (PNG, JPEG, or WebP, up to ${Math.floor(
    MAX_AVATAR_BYTES / 1024,
  )}KB) for the current user and return its public URL. Replaces any existing avatar.`,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: uploadAvatarBody } },
    },
  },
  responses: {
    200: jsonResponse("Avatar stored", avatarSchema),
    400: errorResponse(
      "Unsupported content type, malformed base64, or too large",
    ),
  },
});

const deleteAvatarRoute = createRoute({
  method: "delete",
  operationId: "deleteUserAvatar",
  path: "/avatar",
  tags: ["User"],
  summary: "Delete avatar",
  description:
    "Remove the uploaded avatar of the current user. Succeeds even when there was nothing to remove.",
  responses: {
    200: jsonResponse("Avatar removed", avatarDeletedSchema),
  },
});

const user = apiRouter()
  .openapi(uploadAvatarRoute, async (c) => {
    const { contentType, data } = c.req.valid("json");
    try {
      return c.json(
        await saveAvatar({ userId: c.get("userId"), contentType, data }),
        200,
      );
    } catch (error) {
      throw new HTTPException(400, {
        message:
          error instanceof Error ? error.message : "Invalid avatar upload",
      });
    }
  })
  .openapi(deleteAvatarRoute, async (c) =>
    c.json(await deleteAvatar(c.get("userId")), 200),
  );

export default user;
