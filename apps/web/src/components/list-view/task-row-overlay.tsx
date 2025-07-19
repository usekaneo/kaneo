import type Task from "@/types/task";

interface TaskRowOverlayProps {
  task: Task;
  projectSlug: string;
}

function TaskRowOverlay(_props: TaskRowOverlayProps) {
  return (
    <div className="h-0.5 w-full bg-indigo-500 rounded-full opacity-80 shadow-sm" />
  );
}

export default TaskRowOverlay;
