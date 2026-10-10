export type SprintStatus = "future" | "active" | "closed";

export type Sprint = {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
  carryOverTasks: { id: string; title: string }[] | null;
  position: number;
  taskCount: number;
  completedTaskCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CloseSprintResult = {
  sprint: Sprint;
  movedTaskIds: string[];
  targetSprintId: string | null;
};

export default Sprint;
