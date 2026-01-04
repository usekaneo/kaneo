import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteTask from "@/fetchers/task/delete-task";
import updateTaskAssignee from "@/fetchers/task/update-task-assignee";
import updateTaskStatus from "@/fetchers/task/update-task-status";

export function useBulkOperations() {
  const queryClientRef = useQueryClient();

  const bulkDelete = useMutation({
    mutationFn: async (taskIds: string[]) => {
      await Promise.all(taskIds.map((id) => deleteTask(id)));
    },
    onSuccess: () => {
      queryClientRef.invalidateQueries({
        queryKey: ["tasks"],
      });
      queryClientRef.invalidateQueries({
        queryKey: ["projects"],
      });
    },
  });

  const bulkArchive = useMutation({
    mutationFn: async (taskIds: string[]) => {
      await Promise.all(
        taskIds.map((id) => updateTaskStatus(id, { status: "archived" })),
      );
    },
    onSuccess: () => {
      queryClientRef.invalidateQueries({
        queryKey: ["tasks"],
      });
      queryClientRef.invalidateQueries({
        queryKey: ["projects"],
      });
    },
  });

  const bulkChangeStatus = useMutation({
    mutationFn: async ({
      taskIds,
      status,
    }: {
      taskIds: string[];
      status: string;
    }) => {
      await Promise.all(taskIds.map((id) => updateTaskStatus(id, { status })));
    },
    onSuccess: () => {
      queryClientRef.invalidateQueries({
        queryKey: ["tasks"],
      });
      queryClientRef.invalidateQueries({
        queryKey: ["projects"],
      });
    },
  });

  const bulkAssign = useMutation({
    mutationFn: async ({
      taskIds,
      userId,
    }: {
      taskIds: string[];
      userId: string;
    }) => {
      await Promise.all(
        taskIds.map((id) => updateTaskAssignee(id, { userId })),
      );
    },
    onSuccess: () => {
      queryClientRef.invalidateQueries({
        queryKey: ["tasks"],
      });
      queryClientRef.invalidateQueries({
        queryKey: ["projects"],
      });
    },
  });

  const bulkMoveToBacklog = useMutation({
    mutationFn: async (taskIds: string[]) => {
      await Promise.all(
        taskIds.map((id) => updateTaskStatus(id, { status: "planned" })),
      );
    },
    onSuccess: () => {
      queryClientRef.invalidateQueries({
        queryKey: ["tasks"],
      });
      queryClientRef.invalidateQueries({
        queryKey: ["projects"],
      });
    },
  });

  return {
    bulkDelete: bulkDelete.mutateAsync,
    bulkArchive: bulkArchive.mutateAsync,
    bulkChangeStatus: bulkChangeStatus.mutateAsync,
    bulkAssign: bulkAssign.mutateAsync,
    bulkMoveToBacklog: bulkMoveToBacklog.mutateAsync,
  };
}
