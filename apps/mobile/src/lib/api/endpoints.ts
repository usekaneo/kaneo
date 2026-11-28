import { ApiError, request } from "./client";
import type {
  Activity,
  AssignedTasks,
  BoardResponse,
  Column,
  CreateTaskBody,
  CurrentUser,
  CustomFieldDefinition,
  CustomFieldValue,
  DescriptionPage,
  ExternalLink,
  FinalizedAsset,
  FullOrganization,
  ImageUploadResponse,
  Json,
  Label,
  Notification,
  NotificationPreferences,
  PendingInvitation,
  Project,
  SearchResponse,
  Task,
  TaskRelation,
  TimeEntry,
  UpdateNotificationPreferences,
  UpdateTaskBody,
  Workspace,
  WorkspaceActivity,
  WorkspaceCapabilities,
  WorkspaceMember,
} from "./types";

const get = <T>(
  path: string,
  query?: Record<string, string | number | null | undefined>,
) => request<T>(path, { query });
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body ?? {} });
const put = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PUT", body: body ?? {} });
const patch = <T>(
  path: string,
  body?: unknown,
  query?: Record<string, string | undefined>,
) => request<T>(path, { method: "PATCH", body: body ?? {}, query });
const del = <T>(
  path: string,
  body?: unknown,
  query?: Record<string, string | undefined>,
) => request<T>(path, { method: "DELETE", body, query });

/** Kaneo REST API. Every route lives under `/api`; Better Auth routes are under `/api/auth`. */
export const api = {
  // --- User ---
  me: () => get<CurrentUser>("api/user/me"),
  updateUser: (body: { name?: string; image?: string | null }) =>
    request<unknown>("api/auth/update-user", {
      method: "POST",
      body,
      keepNulls: true,
    }),
  changePassword: (body: {
    currentPassword: string;
    newPassword: string;
    revokeOtherSessions: boolean;
  }) => post<{ token?: string } | null>("api/auth/change-password", body),
  uploadAvatar: (body: { contentType: string; data: string }) =>
    put<{ id: string; url: string }>("api/user/avatar", body),
  deleteAvatar: () => del<unknown>("api/user/avatar"),
  signOut: () => post<unknown>("api/auth/sign-out"),
  deleteUser: (body: { password?: string }) =>
    post<{ success: boolean; message: string }>("api/auth/delete-user", body),

  // --- Workspaces ---
  /** Older servers have no `api/workspace` list; Better Auth's list works everywhere but carries no role. */
  workspaces: () =>
    get<Workspace[]>("api/workspace").catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 404)
        return get<Workspace[]>("api/auth/organization/list");
      throw e;
    }),
  workspaceCapabilities: (workspaceId: string) =>
    get<WorkspaceCapabilities>(`api/workspace/${workspaceId}/capabilities`),
  workspacePermission: (
    organizationId: string,
    permissions: Record<string, string[]>,
  ) =>
    post<{ success: boolean }>("api/auth/organization/has-permission", {
      organizationId,
      permissions,
    }),
  workspaceMembers: (workspaceId: string, projectId?: string) =>
    get<WorkspaceMember[]>(`api/workspace/${workspaceId}/members`, {
      projectId,
    }),
  createWorkspace: (body: {
    name: string;
    slug: string;
    metadata?: Record<string, string> | null;
  }) => post<Workspace>("api/auth/organization/create", body),
  updateWorkspace: (
    organizationId: string,
    data: {
      name?: string;
      description?: string;
      metadata?: Record<string, Json>;
    },
  ) =>
    request<unknown>("api/auth/organization/update", {
      method: "POST",
      body: { organizationId, data },
      keepNulls: true,
    }),
  deleteWorkspace: (organizationId: string) =>
    post<unknown>("api/auth/organization/delete", { organizationId }),
  leaveWorkspace: (organizationId: string) =>
    post<unknown>("api/auth/organization/leave", { organizationId }),
  setActiveWorkspace: (organizationId: string | null) =>
    request<unknown>("api/auth/organization/set-active", {
      method: "POST",
      body: { organizationId },
      keepNulls: true,
    }),
  fullWorkspace: (organizationId: string) =>
    get<FullOrganization>("api/auth/organization/get-full-organization", {
      organizationId,
    }),
  workspaceRoles: (organizationId: string) =>
    get<{ id?: string; role: string }[]>("api/auth/organization/list-roles", {
      organizationId,
    }),
  inviteMember: (body: {
    organizationId: string;
    email: string;
    role: string;
    resend?: boolean;
  }) => post<unknown>("api/auth/organization/invite-member", body),
  cancelInvitation: (invitationId: string) =>
    post<unknown>("api/auth/organization/cancel-invitation", { invitationId }),
  removeMember: (organizationId: string, memberIdOrEmail: string) =>
    post<unknown>("api/auth/organization/remove-member", {
      organizationId,
      memberIdOrEmail,
    }),
  updateMemberRole: (organizationId: string, memberId: string, role: string) =>
    post<unknown>("api/auth/organization/update-member-role", {
      organizationId,
      memberId,
      role,
    }),
  pendingInvitations: () => get<PendingInvitation[]>("api/invitation/pending"),
  acceptInvitation: (invitationId: string) =>
    post<unknown>("api/auth/organization/accept-invitation", { invitationId }),
  rejectInvitation: (invitationId: string) =>
    post<unknown>("api/auth/organization/reject-invitation", { invitationId }),

  // --- Projects ---
  projects: (workspaceId: string, includeArchived?: boolean) =>
    get<Project[]>("api/project", {
      workspaceId,
      includeArchived: includeArchived ? "true" : undefined,
    }),
  project: (id: string) => get<Project>(`api/project/${id}`),
  createProject: (body: {
    name: string;
    workspaceId: string;
    icon: string;
    slug: string;
  }) => post<Project>("api/project", body),
  updateProject: (
    id: string,
    body: {
      name: string;
      icon: string;
      slug: string;
      description: string;
      isPublic: boolean;
    },
  ) => put<Project>(`api/project/${id}`, body),
  deleteProject: (id: string) => del<unknown>(`api/project/${id}`),
  archiveProject: (id: string) => put<unknown>(`api/project/${id}/archive`),
  unarchiveProject: (id: string) => put<unknown>(`api/project/${id}/unarchive`),
  moveProject: (id: string, workspaceId: string) =>
    put<unknown>(`api/project/${id}/move`, { workspaceId }),

  // --- Tasks ---
  board: (projectId: string, page?: number, relatedPage?: number) =>
    get<BoardResponse>(`api/task/tasks/${projectId}`, {
      page,
      relatedPage,
      limit: 100,
    }),
  assignedTasks: (workspaceId: string) =>
    get<AssignedTasks>("api/task/assigned", { workspaceId }),
  task: (id: string) => get<Task>(`api/task/${id}`, { view: "detail" }),
  taskByTicketId: (ticketId: string, workspaceId?: string) =>
    get<Task>(`api/task/by-ticket-id/${encodeURIComponent(ticketId)}`, {
      workspaceId,
    }),
  descriptionPage: (id: string, offset: number, version?: string) =>
    get<DescriptionPage>(`api/task/${id}/description`, { offset, version }),
  createTask: (projectId: string, body: CreateTaskBody) =>
    post<Task>(`api/task/${projectId}`, body),
  updateTask: (id: string, body: UpdateTaskBody) =>
    put<Task>(`api/task/${id}`, body),
  deleteTask: (id: string) => del<unknown>(`api/task/${id}`),
  updateTitle: (id: string, title: string) =>
    put<Task>(`api/task/title/${id}`, { title }),
  updateDescription: (id: string, description: string) =>
    put<Task>(`api/task/description/${id}`, { description }),
  updateStatus: (id: string, status: string) =>
    put<Task>(`api/task/status/${id}`, { status }),
  updatePriority: (id: string, priority: string) =>
    put<Task>(`api/task/priority/${id}`, { priority }),
  updateAssignee: (id: string, userId: string | null) =>
    request<Task>(`api/task/assignee/${id}`, {
      method: "PUT",
      body: { userId },
      keepNulls: true,
    }),
  updateDueDate: (id: string, dueDate: string | null) =>
    put<Task>(`api/task/due-date/${id}`, { dueDate }),
  moveTask: (
    id: string,
    destinationProjectId: string,
    destinationStatus?: string,
  ) =>
    put<unknown>(`api/task/move/${id}`, {
      destinationProjectId,
      destinationStatus,
    }),
  duplicateTask: (id: string) => post<Task>(`api/task/duplicate/${id}`, {}),
  reorderTasks: (
    projectId: string,
    tasks: { id: string; position: number; status?: string }[],
  ) => post<unknown>("api/task/reorder", { projectId, tasks }),
  createImageUpload: (
    taskId: string,
    body: {
      filename: string;
      contentType: string;
      size: number;
      surface: string;
    },
  ) => put<ImageUploadResponse>(`api/task/image-upload/${taskId}`, body),
  finalizeImageUpload: (
    taskId: string,
    body: {
      key: string;
      filename: string;
      contentType: string;
      size: number;
      surface: string;
    },
  ) => post<FinalizedAsset>(`api/task/image-upload/${taskId}/finalize`, body),

  // --- Columns ---
  columns: (projectId: string) => get<Column[]>(`api/column/${projectId}`),
  createColumn: (
    projectId: string,
    body: { name: string; isFinal?: boolean },
  ) => post<Column>(`api/column/${projectId}`, body),
  updateColumn: (id: string, body: { name?: string; isFinal?: boolean }) =>
    put<Column>(`api/column/${id}`, body),
  deleteColumn: (id: string) => del<unknown>(`api/column/${id}`),
  reorderColumns: (
    projectId: string,
    columns: { id: string; position: number }[],
  ) => put<unknown>(`api/column/reorder/${projectId}`, { columns }),

  // --- Activity & comments ---
  activities: (taskId: string) => get<Activity[]>(`api/activity/${taskId}`),
  workspaceActivity: (workspaceId: string) =>
    get<WorkspaceActivity[]>(`api/activity/workspace/${workspaceId}`),
  createComment: (taskId: string, comment: string) =>
    post<unknown>("api/activity/comment", { taskId, comment }),
  updateComment: (activityId: string, comment: string) =>
    put<unknown>("api/activity/comment", { activityId, comment }),
  deleteComment: (activityId: string) =>
    del<unknown>("api/activity/comment", { activityId }),

  // --- Labels ---
  workspaceLabels: (workspaceId: string) =>
    get<Label[]>(`api/label/workspace/${workspaceId}`),
  taskLabels: (taskId: string) => get<Label[]>(`api/label/task/${taskId}`),
  createLabel: (body: {
    name: string;
    color: string;
    workspaceId: string;
    taskId?: string;
  }) => post<Label>("api/label", body),
  updateLabel: (id: string, body: { name: string; color: string }) =>
    put<Label>(`api/label/${id}`, body),
  deleteLabel: (id: string) => del<unknown>(`api/label/${id}`),
  attachLabel: (labelId: string, taskId: string) =>
    put<unknown>(`api/label/${labelId}/task`, { taskId }),
  /** `taskLabelId` is the task's own copy of the label, not the workspace label. */
  detachLabel: (taskLabelId: string) =>
    del<unknown>(`api/label/${taskLabelId}/task`),

  // --- Time ---
  timeEntries: (taskId: string) =>
    get<TimeEntry[]>(`api/time-entry/task/${taskId}`),
  createTimeEntry: (body: {
    taskId: string;
    startTime: string;
    endTime?: string | null;
    description?: string;
  }) => post<TimeEntry>("api/time-entry", body),
  updateTimeEntry: (
    id: string,
    body: { startTime: string; endTime?: string | null; description?: string },
  ) => put<TimeEntry>(`api/time-entry/${id}`, body),

  // --- Relations & links ---
  relations: (taskId: string) =>
    get<TaskRelation[]>(`api/task-relation/${taskId}`),
  createRelation: (
    sourceTaskId: string,
    targetTaskId: string,
    relationType: string,
  ) =>
    post<unknown>("api/task-relation", {
      sourceTaskId,
      targetTaskId,
      relationType,
    }),
  deleteRelation: (id: string) => del<unknown>(`api/task-relation/${id}`),
  externalLinks: (taskId: string) =>
    get<ExternalLink[]>(`api/external-link/task/${taskId}`),
  createExternalLink: (taskId: string, url: string, title?: string | null) =>
    post<unknown>(`api/external-link/task/${taskId}`, { url, title }),
  deleteExternalLink: (taskId: string, id: string) =>
    del<unknown>(`api/external-link/task/${taskId}/${id}`),

  // --- Custom fields ---
  customFields: (projectId: string) =>
    get<CustomFieldDefinition[]>(`api/custom-field/project/${projectId}`),
  taskCustomFieldValues: (taskId: string) =>
    get<CustomFieldValue[]>(`api/custom-field/task/${taskId}`),
  createCustomField: (body: {
    projectId: string;
    name: string;
    type: string;
    required: boolean;
    defaultValue?: string;
    options?: string[];
  }) => post<unknown>("api/custom-field", body),
  deleteCustomField: (id: string) => del<unknown>(`api/custom-field/${id}`),
  setCustomFieldValue: (taskId: string, fieldId: string, value: string) =>
    put<unknown>("api/custom-field/value", { taskId, fieldId, value }),

  // --- Notifications ---
  notifications: (workspaceId?: string) =>
    get<Notification[]>("api/notification", { workspaceId }),
  markNotificationRead: (id: string) =>
    patch<unknown>(`api/notification/${id}/read`),
  markAllNotificationsRead: (workspaceId?: string) =>
    patch<unknown>("api/notification/read-all", {}, { workspaceId }),
  clearAllNotifications: (workspaceId?: string) =>
    del<unknown>("api/notification/clear-all", undefined, { workspaceId }),
  notificationPreferences: () =>
    get<NotificationPreferences>("api/notification-preferences"),
  updateNotificationPreferences: (body: UpdateNotificationPreferences) =>
    put<unknown>("api/notification-preferences", body),

  // --- Search ---
  search: (q: string, workspaceId: string, type = "all") =>
    get<SearchResponse>("api/search", { q, workspaceId, type, limit: "30" }),
};

export type { Json };
