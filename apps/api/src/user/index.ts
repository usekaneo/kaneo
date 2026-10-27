import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import {
  activeSessionListSchema,
  revokedSessionsSchema,
} from "../sessions/response";
import { listActiveSessions } from "../sessions/list-active-sessions";
import { boundedRequestBody } from "../utils/bounded-request-body";
import { requireUserSession } from "../utils/require-user-session";
import { MAX_AVATAR_BYTES, MAX_AVATAR_REQUEST_BYTES } from "./avatar";
import deleteAvatar from "./controllers/delete-avatar";
import getCurrentUser from "./controllers/get-current-user";
import revokeOwnSession from "./controllers/revoke-own-session";
import saveAvatar from "./controllers/save-avatar";
import {
  requireRemovableAvatar,
  requireUnmanagedAvatar,
} from "./managed-avatar-guards";
import {
  avatarDeletedSchema,
  avatarSchema,
  currentUserSchema,
} from "./response";
import { uploadAvatarBody, userSessionParam } from "./schema";

const getCurrentUserRoute = createRoute({
  method: "get",
  operationId: "getCurrentUser",
  path: "/me",
  tags: ["User"],
  summary: "Get current user",
  description: "Return the currently authenticated user.",
  responses: {
    200: jsonResponse("Current user", currentUserSchema),
    401: errorResponse("Unauthorized"),
    404: errorResponse("User not found"),
  },
});

const uploadAvatarRoute = createRoute({
  method: "put",
  operationId: "uploadUserAvatar",
  path: "/avatar",
  tags: ["User"],
  summary: "Upload avatar",
  description: `Store a base64 encoded avatar (PNG, JPEG, or WebP, up to ${Math.floor(
    MAX_AVATAR_BYTES / 1024,
  )}KB) for the current user and return its public URL. Replaces any existing avatar.`,
  middleware: [
    requireUnmanagedAvatar,
    boundedRequestBody(MAX_AVATAR_REQUEST_BYTES),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: uploadAvatarBody } },
    },
  },
  responses: {
    200: jsonResponse("Avatar stored", avatarSchema),
    403: errorResponse(
      "The custom OAuth/OIDC provider manages the profile picture",
    ),
    408: errorResponse("Request body timed out"),
    413: errorResponse("Request body exceeds the upload limit"),
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
  middleware: [requireRemovableAvatar] as const,
  responses: {
    200: jsonResponse("Avatar removed", avatarDeletedSchema),
    403: errorResponse(
      "The custom OAuth/OIDC provider manages the profile picture",
    ),
  },
});

const listSessionsRoute = createRoute({
  method: "get",
  operationId: "listOwnSessions",
  path: "/sessions",
  tags: ["User"],
  summary: "List your active sessions",
  description:
    "List the current user's signed-in sessions with device, IP address, and activity, marking the one making the request. Tokens are never returned. Requires a user session; API keys are rejected.",
  middleware: [requireUserSession] as const,
  responses: {
    200: jsonResponse(
      "Active sessions, current first",
      activeSessionListSchema,
    ),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Authenticated with an API key"),
  },
});

const revokeSessionRoute = createRoute({
  method: "delete",
  operationId: "revokeOwnSession",
  path: "/sessions/{sessionId}",
  tags: ["User"],
  summary: "Sign out one of your sessions",
  description:
    "End another of the current user's sessions by id and close its realtime connections. To end every other session use better-auth's `POST /api/auth/revoke-other-sessions`; to end the current one, sign out.",
  middleware: [requireUserSession] as const,
  request: { params: userSessionParam },
  responses: {
    200: jsonResponse("Session signed out", revokedSessionsSchema),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Authenticated with an API key"),
    404: errorResponse("No such session for this user"),
    409: errorResponse("The session is the one making the request"),
  },
});

const user = apiRouter()
  .openapi(getCurrentUserRoute, async (c) =>
    c.json(await getCurrentUser(c.get("userId")), 200),
  )
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
  )
  .openapi(listSessionsRoute, async (c) =>
    c.json(
      await listActiveSessions(c.get("userId"), c.get("session")?.id ?? null),
      200,
    ),
  )
  .openapi(revokeSessionRoute, async (c) => {
    const current = c.get("session")?.id ?? "";
    return c.json(
      await revokeOwnSession(
        c.get("userId"),
        current,
        c.req.valid("param").sessionId,
      ),
      200,
    );
  });

export default user;
