import { relations } from "drizzle-orm";
import {
  activityTable,
  githubIntegrationTable,
  labelTable,
  notificationTable,
  projectTable,
  sessionTable,
  taskLabelTable,
  taskTable,
  timeEntryTable,
  userTable,
  workspaceTable,
  workspaceUserTable,
  taskLinkTable,
} from "./schema";

export const userTableRelations = relations(userTable, ({ many }) => ({
  sessions: many(sessionTable),
  workspaces: many(workspaceTable),
  workspaceMemberships: many(workspaceUserTable),
  assignedTasks: many(taskTable),
  timeEntries: many(timeEntryTable),
  activities: many(activityTable),
  notifications: many(notificationTable),
}));

/** Links table relations */
export const taskLinkTableRelations = relations(taskLinkTable, ({ one }) => ({
  fromTask: one(taskTable, {
    fields: [taskLinkTable.fromTaskId],
    references: [taskTable.id],
  }),
  toTask: one(taskTable, {
    fields: [taskLinkTable.toTaskId],
    references: [taskTable.id],
  }),
  createdBy: one(userTable, {
    fields: [taskLinkTable.createdBy],
    references: [userTable.email],
  }),
}));

export const sessionTableRelations = relations(sessionTable, ({ one }) => ({
  user: one(userTable, {
    fields: [sessionTable.userId],
    references: [userTable.id],
  }),
}));

export const workspaceTableRelations = relations(
  workspaceTable,
  ({ one, many }) => ({
    owner: one(userTable, {
      fields: [workspaceTable.ownerEmail],
      references: [userTable.email],
    }),
    members: many(workspaceUserTable),
    projects: many(projectTable),
    labels: many(labelTable),
  }),
);

export const workspaceUserTableRelations = relations(
  workspaceUserTable,
  ({ one }) => ({
    workspace: one(workspaceTable, {
      fields: [workspaceUserTable.workspaceId],
      references: [workspaceTable.id],
    }),
  }),
);

export const projectTableRelations = relations(
  projectTable,
  ({ one, many }) => ({
    workspace: one(workspaceTable, {
      fields: [projectTable.workspaceId],
      references: [workspaceTable.id],
    }),
    tasks: many(taskTable),
    githubIntegration: many(githubIntegrationTable),
  }),
);

export const taskTableRelations = relations(taskTable, ({ one, many }) => ({
  project: one(projectTable, {
    fields: [taskTable.projectId],
    references: [projectTable.id],
  }),
  assignee: one(userTable, {
    fields: [taskTable.userEmail],
    references: [userTable.email],
  }),
  timeEntries: many(timeEntryTable),
  activities: many(activityTable),
  taskLabels: many(taskLabelTable),

  // NEW: task linking
  linksFrom: many(taskLinkTable, { relationName: "linksFrom" }),
  linksTo: many(taskLinkTable, { relationName: "linksTo" }),
}));

export const timeEntryTableRelations = relations(timeEntryTable, ({ one }) => ({
  task: one(taskTable, {
    fields: [timeEntryTable.taskId],
    references: [taskTable.id],
  }),
  user: one(userTable, {
    fields: [timeEntryTable.userEmail],
    references: [userTable.email],
  }),
}));

export const activityTableRelations = relations(activityTable, ({ one }) => ({
  task: one(taskTable, {
    fields: [activityTable.taskId],
    references: [taskTable.id],
  }),
  user: one(userTable, {
    fields: [activityTable.userEmail],
    references: [userTable.email],
  }),
}));

export const labelTableRelations = relations(labelTable, ({ one, many }) => ({
  workspace: one(workspaceTable, {
    fields: [labelTable.workspaceId],
    references: [workspaceTable.id],
  }),
  taskLabels: many(taskLabelTable),
}));

export const taskLabelTableRelations = relations(taskLabelTable, ({ one }) => ({
  task: one(taskTable, {
    fields: [taskLabelTable.taskId],
    references: [taskTable.id],
  }),
  label: one(labelTable, {
    fields: [taskLabelTable.labelId],
    references: [labelTable.id],
  }),
}));

export const notificationTableRelations = relations(
  notificationTable,
  ({ one }) => ({
    user: one(userTable, {
      fields: [notificationTable.userEmail],
      references: [userTable.email],
    }),
  }),
);

export const githubIntegrationTableRelations = relations(
  githubIntegrationTable,
  ({ one }) => ({
    project: one(projectTable, {
      fields: [githubIntegrationTable.projectId],
      references: [projectTable.id],
    }),
  }),
);
