import { createId } from "@paralleldrive/cuid2";
import { int, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const userTable = sqliteTable("user", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(new Date())
    .notNull(),
});

export const sessionTable = sqliteTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  expiresAt: integer("expires_at", {
    mode: "timestamp",
  }).notNull(),
});

export const workspaceTable = sqliteTable("workspace", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ownerEmail: text("owner_email")
    .notNull()
    .references(() => userTable.email, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(new Date())
    .notNull(),
});

export const workspaceUserTable = sqliteTable("workspace_member", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaceTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  userEmail: text("user_email")
    .notNull()
    .references(() => userTable.email, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  role: text("role"),
  joinedAt: integer("joined_at", { mode: "timestamp" })
    .default(new Date())
    .notNull(),
});

export const projectTable = sqliteTable("project", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaceTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  slug: text("slug").notNull(),
  icon: text("icon").default("Layout"),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(new Date())
    .notNull(),
});

export const taskTable = sqliteTable("task", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projectTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  number: int().default(1),
  userEmail: text("assignee_email").references(() => userTable.email, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("to-do"),
  priority: text("priority").default("low"),
  dueDate: integer("due_date", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(new Date())
    .notNull(),
});
