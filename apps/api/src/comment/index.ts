import { activitySchema } from "../activity/response";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createComment from "./controllers/create-comment";
import deleteComment from "./controllers/delete-comment";
import getComments from "./controllers/get-comments";
import updateComment from "./controllers/update-comment";
import { commentListSchema } from "./response";
import {
  commentParam,
  createCommentBody,
  taskIdParam,
  updateCommentBody,
} from "./schema";

const getTaskCommentsRoute = createRoute({
  method: "get",
  operationId: "getTaskComments",
  path: "/{taskId}",
  tags: ["Comments"],
  summary: "Get task comments",
  description:
    "Get every comment on a task, oldest first, each with its author's name and avatar.",
  middleware: [workspaceAccess.fromTaskId()] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("List of comments for the task", commentListSchema),
    400: errorResponse(
      "Unknown task, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the task's workspace"),
  },
});

const createTaskCommentRoute = createRoute({
  method: "post",
  operationId: "createTaskComment",
  path: "/{taskId}",
  tags: ["Comments"],
  summary: "Create task comment",
  description:
    "Add a comment to a task. Mentions in the content notify the mentioned users, and the assignee is notified too. Returns the stored activity row, which carries no author object -- read the list route for that.",
  middleware: [
    workspaceAccess.fromTaskId(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: taskIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createCommentBody } },
    },
  },
  responses: {
    200: jsonResponse("The created comment", activitySchema),
    400: errorResponse("Invalid body, or unknown task"),
    403: errorResponse(
      "No workspace access, or missing task:update permission",
    ),
  },
});

const updateTaskCommentRoute = createRoute({
  method: "put",
  operationId: "updateTaskComment",
  path: "/{id}",
  tags: ["Comments"],
  summary: "Update task comment",
  description: "Edit a comment. Only the comment's author may do this.",
  middleware: [
    workspaceAccess.fromComment(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: commentParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateCommentBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated comment", activitySchema),
    400: errorResponse("Invalid body, or unknown comment"),
    403: errorResponse("Not the author, or missing task:update permission"),
    404: errorResponse("Comment not found"),
  },
});

const deleteTaskCommentRoute = createRoute({
  method: "delete",
  operationId: "deleteTaskComment",
  path: "/{id}",
  tags: ["Comments"],
  summary: "Delete task comment",
  description: "Delete a comment. Only the comment's author may do this.",
  middleware: [
    workspaceAccess.fromComment(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: commentParam },
  responses: {
    200: jsonResponse("The deleted comment", activitySchema),
    400: errorResponse(
      "Unknown comment, or its workspace could not be determined",
    ),
    403: errorResponse("Not the author, or missing task:update permission"),
    404: errorResponse("Comment not found"),
  },
});

const comment = apiRouter()
  .openapi(getTaskCommentsRoute, async (c) =>
    c.json(await getComments(c.req.valid("param").taskId), 200),
  )
  .openapi(createTaskCommentRoute, async (c) => {
    const { taskId } = c.req.valid("param");
    const { content, externalUserName, externalSource } = c.req.valid("json");
    // Both or neither: a name without a source would render as an
    // unattributed impersonation of a real account.
    const external =
      externalUserName && externalSource
        ? { userName: externalUserName, source: externalSource }
        : undefined;
    return c.json(
      await createComment(taskId, c.get("userId"), content, external),
      200,
    );
  })
  .openapi(updateTaskCommentRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { content } = c.req.valid("json");
    return c.json(await updateComment(c.get("userId"), id, content), 200);
  })
  .openapi(deleteTaskCommentRoute, async (c) =>
    c.json(await deleteComment(c.get("userId"), c.req.valid("param").id), 200),
  );

export default comment;
