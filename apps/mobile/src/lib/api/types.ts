/** Kaneo REST API shapes. Optional fields may be missing or null depending on the server version. */

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export type InstanceConfig = {
  isCloud?: boolean;
  disableRegistration?: boolean;
  disablePasswordRegistration?: boolean;
  disableEmailOtpSignIn?: boolean;
  disableWorkspaceCreation?: boolean;
  hasSmtp?: boolean;
  hasGithubSignIn?: boolean;
  hasGoogleSignIn?: boolean;
  hasDiscordSignIn?: boolean;
  hasCustomOAuth?: boolean;
  disableLoginForm?: boolean;
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string | null;
};

export type AuthTokenResponse = {
  token?: string | null;
  user?: { id: string; name?: string; email?: string } | null;
};

export type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string | null;
  interval?: number;
  expires_in?: number;
};

export type DeviceTokenResponse = {
  access_token?: string | null;
  error?: string | null;
  error_description?: string | null;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  createdAt?: string | null;
  role?: string | null;
  metadata?: Json;
};

export type WorkspaceMember = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: string;
};

export type OrganizationInvitation = {
  id: string;
  email: string;
  role?: string | null;
  status: string;
  expiresAt?: string | null;
};

export type OrganizationMember = {
  id: string;
  userId: string;
  role: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    image?: string | null;
  } | null;
};

export type FullOrganization = {
  id: string;
  name: string;
  slug: string;
  metadata?: Json;
  members?: OrganizationMember[];
  invitations?: OrganizationInvitation[];
};

export type PendingInvitation = {
  id: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
  expiresAt?: string | null;
  createdAt?: string | null;
  status: string;
};

export type Project = {
  id: string;
  workspaceId: string;
  slug: string;
  icon?: string | null;
  name: string;
  description?: string | null;
  createdAt?: string | null;
  isPublic?: boolean | null;
  archivedAt?: string | null;
  position?: number | null;
  statistics?: {
    completionPercentage?: number;
    totalTasks?: number;
    dueDate?: string | null;
  } | null;
};

export type TaskLabel = { id: string; name: string; color: string };

export type BoardTask = {
  id: string;
  title: string;
  number?: number | null;
  description?: string | null;
  status: string;
  priority?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  position?: number | null;
  createdAt?: string | null;
  userId?: string | null;
  assigneeName?: string | null;
  assigneeId?: string | null;
  assigneeImage?: string | null;
  projectId: string;
  subtaskCounts?: { completed?: number; total?: number } | null;
  labels?: TaskLabel[];
};

export type BoardColumn = {
  id: string;
  slug: string;
  name: string;
  icon?: string | null;
  isFinal?: boolean;
  position?: number | null;
  tasks?: BoardTask[];
};

export type BoardData = {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  isPublic?: boolean | null;
  workspaceId: string;
  columns: BoardColumn[];
  archivedTasks: BoardTask[];
  plannedTasks: BoardTask[];
};

export type BoardResponse = {
  data: BoardData;
  pagination?: {
    total?: number;
    page?: number;
    totalPages?: number;
    relatedPage?: number;
    relatedTotalPages?: number;
  };
};

export type Task = {
  id: string;
  projectId: string;
  position?: number | null;
  number?: number | null;
  userId?: string | null;
  title: string;
  description?: string | null;
  descriptionDeferred?: boolean | null;
  status: string;
  priority?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  createdAt?: string | null;
  workspaceId?: string | null;
  columnId?: string | null;
  assigneeName?: string | null;
  assigneeId?: string | null;
};

export type DescriptionPage = {
  content: string;
  version: string;
  nextOffset?: number | null;
};

export type AssignedTask = {
  id: string;
  projectId: string;
  number?: number | null;
  title: string;
  status: string;
  statusName?: string | null;
  statusIcon?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  projectName: string;
  projectIcon?: string | null;
  projectSlug: string;
  labels?: TaskLabel[];
};

export type AssignedTasks = { tasks: AssignedTask[]; total?: number };

export type Column = {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  position?: number;
  icon?: string | null;
  color?: string | null;
  isFinal?: boolean;
};

export type Activity = {
  id: string;
  taskId: string;
  type: string;
  createdAt: string;
  updatedAt?: string | null;
  userId?: string | null;
  content?: string | null;
  eventData?: Json;
  externalUserName?: string | null;
  externalSource?: string | null;
};

export type WorkspaceActivity = {
  id: string;
  type: string;
  createdAt: string;
  eventData?: Json;
  excerpt?: string | null;
  userId?: string | null;
  userName?: string | null;
  userImage?: string | null;
  externalUserName?: string | null;
  taskId: string;
  taskTitle: string;
  taskNumber?: number | null;
  projectId: string;
  projectSlug: string;
};

export type Label = {
  id: string;
  name: string;
  color: string;
  taskId?: string | null;
  workspaceId?: string | null;
  deletionStartedAt?: string | null;
};

export type TimeEntry = {
  id: string;
  taskId: string;
  userId?: string | null;
  userName?: string | null;
  startTime: string;
  endTime?: string | null;
  duration?: number | null;
  description?: string | null;
};

export type RelatedTask = {
  id: string;
  title: string;
  status: string;
  isCompleted?: boolean;
  priority?: string | null;
  number?: number | null;
  projectId: string;
  assigneeName?: string | null;
};

export type TaskRelation = {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  relationType: string;
  sourceTask?: RelatedTask | null;
  targetTask?: RelatedTask | null;
};

export type ExternalLink = {
  id: string;
  taskId: string;
  integrationId?: string | null;
  resourceType: string;
  externalId: string;
  url: string;
  title?: string | null;
};

export type CustomFieldDefinition = {
  id: string;
  projectId: string;
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string | null;
  options?: Json;
  position?: number;
};

export type CustomFieldValue = {
  id: string;
  taskId: string;
  fieldId: string;
  value?: string | null;
  fieldName: string;
  fieldType: string;
};

export type Notification = {
  id: string;
  userId: string;
  title?: string | null;
  content?: string | null;
  type: string;
  eventData?: Json;
  isRead?: boolean | null;
  resourceId?: string | null;
  resourceType?: string | null;
  createdAt: string;
};

export type NotificationPreferences = {
  emailAddress?: string | null;
  emailEnabled?: boolean;
  ntfyEnabled?: boolean;
  ntfyServerUrl?: string | null;
  ntfyTopic?: string | null;
  ntfyTokenConfigured?: boolean;
  gotifyEnabled?: boolean;
  gotifyServerUrl?: string | null;
  gotifyTokenConfigured?: boolean;
  webhookEnabled?: boolean;
  webhookUrl?: string | null;
  webhookSecretConfigured?: boolean;
  taskAssignmentEnabled?: boolean;
  taskCommentEnabled?: boolean;
  taskStatusChangeEnabled?: boolean;
  dueDateReminderEnabled?: boolean;
  dueDateReminderLeadTimeMinutes?: number;
};

/** Fields left undefined are omitted from the request, which keeps the server value. */
export type UpdateNotificationPreferences = Partial<{
  emailEnabled: boolean;
  ntfyEnabled: boolean;
  ntfyServerUrl: string;
  ntfyTopic: string;
  ntfyToken: string;
  gotifyEnabled: boolean;
  gotifyServerUrl: string;
  gotifyToken: string;
  webhookEnabled: boolean;
  webhookUrl: string;
  webhookSecret: string;
  taskAssignmentEnabled: boolean;
  taskCommentEnabled: boolean;
  taskStatusChangeEnabled: boolean;
  dueDateReminderEnabled: boolean;
  dueDateReminderLeadTimeMinutes: number;
}>;

export type SearchResult = {
  id: string;
  type: string;
  title: string;
  content?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  projectSlug?: string | null;
  workspaceId?: string | null;
  workspaceName?: string | null;
  userName?: string | null;
  createdAt?: string | null;
  taskNumber?: number | null;
  priority?: string | null;
  status?: string | null;
};

export type SearchResponse = { results: SearchResult[]; totalCount?: number };

export type ImageUploadResponse = {
  key: string;
  uploadUrl: string;
  headers?: Record<string, string>;
};
export type FinalizedAsset = { id: string; url: string };

export type CreateTaskBody = {
  title: string;
  description: string;
  startDate?: string | null;
  dueDate?: string | null;
  priority: string;
  status: string;
  userId?: string | null;
  customFields?: { fieldId: string; value: string }[];
};

export type UpdateTaskBody = {
  title: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  priority: string;
  status: string;
  projectId: string;
  position: number;
  userId?: string | null;
};
