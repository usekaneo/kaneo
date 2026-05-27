type Task = {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  assigneeName?: string | null;
  assigneeImage?: string | null;
  description: string | null;
  columnId?: string | null;
  projectId: string;
  workspaceId: string;
  userId: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export default Task;
