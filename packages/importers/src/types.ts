export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export type ImportedPriority =
  | "no-priority"
  | "low"
  | "medium"
  | "high"
  | "urgent";

export type ImportedSprintStatus = "future" | "active" | "closed";

export type ImportedSprint = {
  key: string;
  name: string;
  status: ImportedSprintStatus;
  goal?: string;
  startDate?: string;
  endDate?: string;
};

export type ImportedColumn = {
  key: string;
  name: string;
  isFinal: boolean;
};

export type ImportedLabel = {
  key: string;
  name: string;
  color: string;
};

export type ImportedPerson = {
  name?: string;
  email?: string;
};

export type ImportedComment = {
  author: ImportedPerson;
  body: string;
  createdAt?: string;
};

export type ImportedTask = {
  key: string;
  number?: number;
  columnKey: string | null;
  archived?: boolean;
  title: string;
  description: string;
  priority: ImportedPriority;
  startDate?: string;
  dueDate?: string;
  createdAt?: string;
  // Source key of the sprint this task belongs to; absent or null means the
  // task is unscheduled and lands in the backlog.
  sprintKey?: string | null;
  assignee?: ImportedPerson;
  labelKeys: string[];
  comments: ImportedComment[];
};

export type ImportedRelationType = "subtask" | "blocks" | "related";

export type ImportedRelation = {
  sourceKey: string;
  targetKey: string;
  type: ImportedRelationType;
};

export type ImportedProject = {
  name: string;
  key?: string;
  description?: string;
  columns: ImportedColumn[];
  labels: ImportedLabel[];
  // Sprints recovered from the source, if the source exposes them.
  sprints?: ImportedSprint[];
  tasks: ImportedTask[];
  relations: ImportedRelation[];
  warnings: string[];
};

export type SourceProject = {
  id: string;
  name: string;
  detail?: string;
};

export type ReadProjectOptions = {
  includeComments: boolean;
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
};

export type ImportSource = {
  listProjects(): Promise<SourceProject[]>;
  readProject(
    projectId: string,
    options: ReadProjectOptions,
  ): Promise<ImportedProject>;
};

export type ConnectOptions = {
  fetch?: FetchLike;
  signal?: AbortSignal;
};
