type TaskLabel = {
  id: string;
  name: string;
  color: string;
};

type TaskExternalLink = {
  id: string;
  taskId: string;
  integrationId: string;
  resourceType: string;
  externalId: string;
  url: string;
  title: string | null;
  metadata: Record<string, unknown> | null;
};

type Task = {
  id: string;
  title: string;
  number: number | null;
  description: string | null;
  status: string;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  position: number | null;
  createdAt: string;
  updatedAt?: string;
  userId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeImage?: string | null;
  projectId: string;
  columnId?: string | null;
  labels?: TaskLabel[];
  externalLinks?: TaskExternalLink[];
  // Parent/subtask bookkeeping. Populated by the backend when a project
  // task list is fetched so the UI can render parent-child links without a
  // second round-trip per card. `parentTaskId` is null for top-level tasks.
  parentTaskId?: string | null;
  subtasks?: string[];
  // True when the parent has at least one subtask not in a final column.
  // Lets the UI surface a "waiting on subtasks" hint without re-deriving.
  hasOpenSubtasks?: boolean;
};

export default Task;
