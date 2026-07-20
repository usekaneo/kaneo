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

export type TaskHierarchyMeta = {
  parentId: string | null;
  directSubtaskCount: number;
  completedSubtaskCount: number;
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
  parentId?: string | null;
  directSubtaskCount?: number;
  completedSubtaskCount?: number;
};

export type TaskWithHierarchy = Task & Required<TaskHierarchyMeta>;

export type TaskTreeNode = TaskWithHierarchy & {
  depth: number;
  hasChildren: boolean;
  parentInSameColumn: boolean;
  parentTitle?: string | null;
};

export default Task;
