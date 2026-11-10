import {
  text,
  timestamp,
  primaryKey,
  foreignKey,
  index,
} from "drizzle-orm/pg-core";
import { typeIdColumn } from "@kaneo/ids/drizzle";
import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { projectTable, taskTable } from "../../schema";
import { boards } from "./boards";
import { posts } from "./posts";

export const boardProjects = quillsSchema
  .table(
    "board_projects",
    {
      workspaceId: workspaceColumn(),
      boardId: typeIdColumn("board")("board_id").notNull(),
      projectId: text("project_id").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      primaryKey({ columns: [t.workspaceId, t.boardId, t.projectId] }),
      foreignKey({
        columns: [t.workspaceId, t.boardId],
        foreignColumns: [boards.workspaceId, boards.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [t.workspaceId, t.projectId],
        foreignColumns: [projectTable.workspaceId, projectTable.id],
      }).onDelete("cascade"),
      index("board_projects_project_idx").on(t.projectId),
      workspacePolicy(t.workspaceId),
    ],
  )
  .enableRLS();

export const postTasks = quillsSchema
  .table(
    "post_tasks",
    {
      workspaceId: workspaceColumn(),
      postId: typeIdColumn("post")("post_id").notNull(),
      taskId: text("task_id")
        .notNull()
        .references(() => taskTable.id, { onDelete: "cascade" }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      primaryKey({ columns: [t.workspaceId, t.postId, t.taskId] }),
      foreignKey({
        columns: [t.workspaceId, t.postId],
        foreignColumns: [posts.workspaceId, posts.id],
      }).onDelete("cascade"),
      index("post_tasks_task_idx").on(t.taskId),
      workspacePolicy(t.workspaceId),
    ],
  )
  .enableRLS();
