import { and, eq, inArray, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { flexibleToTypeIdSchema } from "@kaneo/ids/zod";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
  type BaseVariables,
} from "../openapi";
import platformDb from "../database";
import { projectTable, taskTable } from "../database/schema";
import {
  boardProjects,
  postTasks,
} from "../database/quills/schema/platform-links";
import { boards } from "../database/quills/schema/boards";
import { posts } from "../database/quills/schema/posts";
import { withQuillsRequest } from "./with-quills-request";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { findInaccessibleProjectIds } from "../project-access/find-inaccessible-project-ids";
import { recordQuillsChange } from "./events";
import type { Context } from "hono";

const workspace = z.object({ workspaceId: z.string().min(1) });
const boardParams = workspace.extend({
  boardId: flexibleToTypeIdSchema("board"),
  projectId: z.string().min(1),
});
const postParams = workspace.extend({
  postId: flexibleToTypeIdSchema("post"),
  taskId: z.string().min(1),
});
const middleware = [
  workspaceAccess.fromParam("workspaceId"),
  requireWorkspacePermission({ project: ["read"] }),
];
const responses = {
  200: jsonResponse("Link updated", z.object({ changed: z.boolean() })),
  401: errorResponse("Authentication required"),
  403: errorResponse("Insufficient access"),
  404: errorResponse("Resource not found"),
};
async function changeBoard(
  c: Context,
  params: z.output<typeof boardParams>,
  add: boolean,
) {
  return withQuillsRequest(
    c,
    { action: "update", projectId: params.projectId },
    async (db, actor) => {
      const [board] = await db
        .select({ id: boards.id })
        .from(boards)
        .where(and(eq(boards.id, params.boardId), isNull(boards.deletedAt)))
        .limit(1);
      if (!board) throw new HTTPException(404, { message: "Board not found" });
      const predicate = and(
        eq(boardProjects.boardId, params.boardId),
        eq(boardProjects.projectId, params.projectId),
      );
      const rows = add
        ? await db
            .insert(boardProjects)
            .values({ boardId: params.boardId, projectId: params.projectId })
            .onConflictDoNothing()
            .returning()
        : await db.delete(boardProjects).where(predicate).returning();
      if (rows.length)
        await recordQuillsChange(db, actor, {
          type: add ? "board.project_linked" : "board.project_unlinked",
          entityType: "board",
          entityId: params.boardId,
          payload: { projectId: params.projectId },
        });
      return { changed: rows.length > 0 };
    },
  );
}
async function changePost(
  c: Context,
  params: z.output<typeof postParams>,
  add: boolean,
) {
  const [task] = await platformDb
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        eq(taskTable.id, params.taskId),
        eq(projectTable.workspaceId, params.workspaceId),
      ),
    )
    .limit(1);
  if (!task?.projectId)
    throw new HTTPException(404, { message: "Task not found" });
  return withQuillsRequest(
    c,
    { action: "update", projectId: task.projectId },
    async (db, actor) => {
      const [post] = await db
        .select({ id: posts.id })
        .from(posts)
        .where(and(eq(posts.id, params.postId), isNull(posts.deletedAt)))
        .limit(1);
      if (!post) throw new HTTPException(404, { message: "Post not found" });
      const predicate = and(
        eq(postTasks.postId, params.postId),
        eq(postTasks.taskId, params.taskId),
      );
      const rows = add
        ? await db
            .insert(postTasks)
            .values({ postId: params.postId, taskId: params.taskId })
            .onConflictDoNothing()
            .returning()
        : await db.delete(postTasks).where(predicate).returning();
      if (rows.length)
        await recordQuillsChange(db, actor, {
          type: add ? "post.task_linked" : "post.task_unlinked",
          entityType: "post",
          entityId: params.postId,
          payload: { taskId: params.taskId },
        });
      return { changed: rows.length > 0 };
    },
  );
}
export default apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(
    createRoute({
      method: "put",
      path: "/{workspaceId}/boards/{boardId}/projects/{projectId}",
      operationId: "linkQuillsBoardToProject",
      tags: ["Quills"],
      summary: "Link a Quills board to a project",
      middleware,
      request: { params: boardParams },
      responses,
    }),
    async (c) => c.json(await changeBoard(c, c.req.valid("param"), true), 200),
  )
  .openapi(
    createRoute({
      method: "delete",
      path: "/{workspaceId}/boards/{boardId}/projects/{projectId}",
      operationId: "unlinkQuillsBoardFromProject",
      tags: ["Quills"],
      summary: "Unlink a Quills board from a project",
      middleware,
      request: { params: boardParams },
      responses,
    }),
    async (c) => c.json(await changeBoard(c, c.req.valid("param"), false), 200),
  )
  .openapi(
    createRoute({
      method: "put",
      path: "/{workspaceId}/posts/{postId}/tasks/{taskId}",
      operationId: "linkQuillsPostToTask",
      tags: ["Quills"],
      summary: "Link a Quills post to a task",
      middleware,
      request: { params: postParams },
      responses,
    }),
    async (c) => c.json(await changePost(c, c.req.valid("param"), true), 200),
  )
  .openapi(
    createRoute({
      method: "delete",
      path: "/{workspaceId}/posts/{postId}/tasks/{taskId}",
      operationId: "unlinkQuillsPostFromTask",
      tags: ["Quills"],
      summary: "Unlink a Quills post from a task",
      middleware,
      request: { params: postParams },
      responses,
    }),
    async (c) => c.json(await changePost(c, c.req.valid("param"), false), 200),
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/{workspaceId}/links",
      operationId: "listQuillsLinks",
      tags: ["Quills"],
      summary: "List visible Quills board and post links",
      middleware,
      request: {
        params: workspace,
        query: z.object({
          offset: z.coerce.number().int().min(0).max(10000000).default(0),
          limit: z.coerce.number().int().min(1).max(100).default(100),
        }),
      },
      responses: {
        ...responses,
        200: jsonResponse(
          "Visible product links",
          z.object({
            nextOffset: z.number().nullable(),
            boards: z.array(
              z.object({ boardId: z.string(), projectId: z.string() }),
            ),
            posts: z.array(
              z.object({ postId: z.string(), taskId: z.string() }),
            ),
          }),
        ),
      },
    }),
    async (c) => {
      const { offset, limit } = c.req.valid("query");
      const result = await withQuillsRequest(
        c,
        { action: "read" },
        async (db) => ({
          boards: await db
            .select({
              boardId: boardProjects.boardId,
              projectId: boardProjects.projectId,
            })
            .from(boardProjects)
            .orderBy(boardProjects.boardId, boardProjects.projectId)
            .offset(offset)
            .limit(limit + 1),
          posts: await db
            .select({ postId: postTasks.postId, taskId: postTasks.taskId })
            .from(postTasks)
            .orderBy(postTasks.postId, postTasks.taskId)
            .offset(offset)
            .limit(limit + 1),
        }),
      );
      const nextOffset =
        result.boards.length > limit || result.posts.length > limit
          ? offset + limit
          : null;
      result.boards = result.boards.slice(0, limit);
      result.posts = result.posts.slice(0, limit);
      const taskIds = [...new Set(result.posts.map((p) => p.taskId))];
      const tasks = taskIds.length
        ? await platformDb
            .select({ id: taskTable.id, projectId: taskTable.projectId })
            .from(taskTable)
            .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
            .where(
              and(
                inArray(taskTable.id, taskIds),
                eq(projectTable.workspaceId, c.get("workspaceId")),
              ),
            )
        : [];
      const projectIds = [...new Set(result.boards.map((b) => b.projectId))];
      const projects = projectIds.length
        ? await platformDb
            .select({ id: projectTable.id })
            .from(projectTable)
            .where(
              and(
                inArray(projectTable.id, projectIds),
                eq(projectTable.workspaceId, c.get("workspaceId")),
              ),
            )
        : [];
      const present = new Set(projects.map((p) => p.id));
      const denied = new Set(
        await findInaccessibleProjectIds(c.get("userId"), [
          ...result.boards.map((b) => b.projectId),
          ...tasks.flatMap((t) => (t.projectId ? [t.projectId] : [])),
        ]),
      );
      const allowedTasks = new Set(
        tasks
          .filter((t) => t.projectId && !denied.has(t.projectId))
          .map((t) => t.id),
      );
      return c.json(
        {
          nextOffset,
          boards: result.boards.filter(
            (b) => present.has(b.projectId) && !denied.has(b.projectId),
          ),
          posts: result.posts.filter((p) => allowedTasks.has(p.taskId)),
        },
        200,
      );
    },
  );
