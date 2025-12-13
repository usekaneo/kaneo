import * as v from "valibot";

export const labelSchema = v.object({
  id: v.string(),
  name: v.string(),
  color: v.string(),
  createdAt: v.date(),
  taskId: v.nullable(v.string()),
  workspaceId: v.nullable(v.string()),
});

export const projectSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  slug: v.string(),
  icon: v.nullable(v.string()),
  name: v.string(),
  description: v.nullable(v.string()),
  createdAt: v.date(),
  isPublic: v.nullable(v.boolean()),
});

export const taskSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  position: v.nullable(v.number()),
  number: v.nullable(v.number()),
  userId: v.nullable(v.string()),
  title: v.string(),
  description: v.nullable(v.string()),
  status: v.string(),
  priority: v.nullable(v.string()),
  dueDate: v.nullable(v.date()),
  createdAt: v.date(),
});

export const activitySchema = v.object({
  id: v.string(),
  taskId: v.string(),
  type: v.string(),
  createdAt: v.date(),
  userId: v.string(),
  content: v.nullable(v.string()),
});

export const timeEntrySchema = v.object({
  id: v.string(),
  taskId: v.string(),
  userId: v.nullable(v.string()),
  description: v.nullable(v.string()),
  startTime: v.date(),
  endTime: v.nullable(v.date()),
  duration: v.nullable(v.number()),
  createdAt: v.date(),
});

export const notificationSchema = v.object({
  id: v.string(),
  userId: v.string(),
  title: v.string(),
  content: v.nullable(v.string()),
  type: v.string(),
  isRead: v.nullable(v.boolean()),
  resourceId: v.nullable(v.string()),
  resourceType: v.nullable(v.string()),
  createdAt: v.date(),
});

export const githubIntegrationSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  repositoryOwner: v.string(),
  repositoryName: v.string(),
  installationId: v.nullable(v.number()),
  isActive: v.nullable(v.boolean()),
  createdAt: v.date(),
});

export const configSchema = v.object({
  disableRegistration: v.nullable(v.boolean()),
  isDemoMode: v.boolean(),
  hasSmtp: v.boolean(),
  hasGithubSignIn: v.nullable(v.boolean()),
  hasGoogleSignIn: v.nullable(v.boolean()),
  hasDiscordSignIn: v.nullable(v.boolean()),
  hasCustomOAuth: v.nullable(v.boolean()),
  hasGuestAccess: v.nullable(v.boolean()),
});
