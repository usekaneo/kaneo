export type TimeEntry = {
  duration: number | null;
  id: string;
  createdAt: string;
  description: string | null;
  userId: string | null;
  taskId: string;
  startTime: string;
  endTime: string | null;
};
