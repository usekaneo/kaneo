import { useMutation, useQueryClient } from "@tanstack/react-query";
import bulkOperation, {
  type BulkScheduleUpdate,
} from "@/fetchers/task/bulk-operation";

/**
 * Persists a Gantt dependency cascade (see gantt-dependency-cascade.ts) in
 * ONE request: every dependent task the drag/resize just pushed forward,
 * written together via the `updateSchedule` bulk operation rather than one
 * request per shifted task.
 */
export function useBulkUpdateTaskSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scheduleUpdates,
    }: {
      projectId: string;
      scheduleUpdates: BulkScheduleUpdate[];
    }) =>
      bulkOperation({
        taskIds: scheduleUpdates.map((update) => update.taskId),
        operation: "updateSchedule",
        scheduleUpdates,
      }),
    onSuccess: (_, variables) => {
      // Same cache invalidation useUpdateTask applies for a single-task date
      // edit — every shifted task here is, by construction (see
      // gantt-dependency-cascade.ts's scoping), one of this project's own
      // tasks, so a single project-scoped invalidation covers all of them.
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      // Each shifted task's own detail cache, so an open task view reflects
      // the cascade-pushed dates.
      for (const update of variables.scheduleUpdates) {
        queryClient.invalidateQueries({
          queryKey: ["task", update.taskId],
        });
      }
      // A cascade moves task dates, which changes how a shifted task renders
      // as an external (cross-project) row on ANOTHER project's Gantt chart.
      // useUpdateTask invalidates this same key for the same reason; the bulk
      // path must too, or the other project keeps showing pre-cascade dates.
      queryClient.invalidateQueries({
        queryKey: ["task-relations", "project"],
      });
    },
  });
}
