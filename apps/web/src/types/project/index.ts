export type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  workspaceId: string;
  columns?: Column[];
  icon: string | null;
};

export type Column = {
  id: string;
  name: string;
  tasks: Task[];
};

export type Task = {
  id: string;
  createdAt: Date;
  number: number | null;
  description: string | null;
  projectId: string;
  userEmail: string | null;
  title: string;
  status: string;
  dueDate: Date | null;
  priority: string | null;
  projectSlug?: string;
  position: number | null;
};
