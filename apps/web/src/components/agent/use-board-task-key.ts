import { useCallback, useMemo } from "react";
import useProjectStore from "@/store/project";

// Resolves "SLUG-12" keys for tasks already loaded on the current board.
export function useBoardTaskKey(projectId: string) {
  const project = useProjectStore((state) => state.project);

  const numbers = useMemo(() => {
    const map = new Map<string, number>();
    if (!project || project.id !== projectId) return map;
    for (const task of [
      ...project.columns.flatMap((column) => column.tasks),
      ...project.plannedTasks,
      ...project.archivedTasks,
    ])
      if (task.number != null) map.set(task.id, task.number);
    return map;
  }, [project, projectId]);

  return useCallback(
    (taskId: string) => {
      const number = numbers.get(taskId);
      return number == null ? undefined : `${project?.slug}-${number}`;
    },
    [numbers, project?.slug],
  );
}
