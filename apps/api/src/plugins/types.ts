export type PluginContext = {
  integrationId: string;
  projectId: string;
  config: Record<string, unknown>;
};

export type TaskCreatedEvent = {
  taskId: string;
  projectId: string;
  userId: string;
  title: string;
  description: string | null;
  priority: string | null;
  status: string;
  number: number;
};

export type TaskStatusChangedEvent = {
  taskId: string;
  projectId: string;
  userId: string | null;
  oldStatus: string;
  newStatus: string;
  title: string;
};

export type TaskPriorityChangedEvent = {
  taskId: string;
  projectId: string;
  userId: string | null;
  oldPriority: string;
  newPriority: string;
  title: string;
};

export type TaskTitleChangedEvent = {
  taskId: string;
  projectId: string;
  userId: string | null;
  oldTitle: string;
  newTitle: string;
};

export type TaskDescriptionChangedEvent = {
  taskId: string;
  projectId: string;
  userId: string | null;
  oldDescription: string | null;
  newDescription: string | null;
};

export type TaskCommentCreatedEvent = {
  taskId: string;
  projectId: string;
  userId: string;
  comment: string;
};

export type TaskEvent =
  | TaskCreatedEvent
  | TaskStatusChangedEvent
  | TaskPriorityChangedEvent
  | TaskTitleChangedEvent
  | TaskDescriptionChangedEvent
  | TaskCommentCreatedEvent;

export type ExternalMetadata = {
  type: "issue" | "pull_request" | "branch";
  id: string;
  externalId: string;
  title: string | null;
  url: string;
  status: string;
  metadata: Record<string, unknown>;
};

export type TaskEventHandler<T extends TaskEvent = TaskEvent> = (
  event: T,
  context: PluginContext,
) => Promise<void>;

export type WebhookHandler = (
  payload: unknown,
  headers: Record<string, string>,
) => Promise<void>;

export type MetadataProvider = (
  taskId: string,
  context: PluginContext,
) => Promise<ExternalMetadata[]>;

export type ConfigValidator = (
  config: unknown,
) => Promise<{ valid: boolean; errors?: string[] }>;

export type IntegrationPlugin = {
  type: string;
  name: string;

  onTaskCreated?: TaskEventHandler<TaskCreatedEvent>;
  onTaskStatusChanged?: TaskEventHandler<TaskStatusChangedEvent>;
  onTaskPriorityChanged?: TaskEventHandler<TaskPriorityChangedEvent>;
  onTaskTitleChanged?: TaskEventHandler<TaskTitleChangedEvent>;
  onTaskDescriptionChanged?: TaskEventHandler<TaskDescriptionChangedEvent>;
  onTaskCommentCreated?: TaskEventHandler<TaskCommentCreatedEvent>;

  handleWebhook?: WebhookHandler;
  getTaskMetadata?: MetadataProvider;
  validateConfig: ConfigValidator;
};
