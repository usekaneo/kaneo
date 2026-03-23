import { useMutation, useQueryClient } from "@tanstack/react-query";
import bulkOperation from "@/fetchers/task/bulk-operation";
import deleteTask from "@/fetchers/task/delete-task";

export function useBulkOperations() {
  const queryClientRef = useQueryClient();

  const invalidateCommon = () => {
    queryClientRef.invalidateQueries({ queryKey: ["tasks"] });
    queryClientRef.invalidateQueries({ queryKey: ["projects"] });
  };

  const bulkDelete = useMutation({
    mutationFn: async (taskIds: string[]) => {
      await Promise.all(taskIds.map((id) => deleteTask(id)));
    },
    onSuccess: invalidateCommon,
  });

  const bulkArchive = useMutation({
    mutationFn: async (taskIds: string[]) => {
      await bulkOperation({
        taskIds,
        operation: "updateStatus",
        value: "archived",
      });
    },
    onSuccess: invalidateCommon,
  });

  const bulkChangeStatus = useMutation({
    mutationFn: async ({
      taskIds,
      status,
    }: {
      taskIds: string[];
      status: string;
    }) => {
      await bulkOperation({
        taskIds,
        operation: "updateStatus",
        value: status,
      });
    },
    onSuccess: invalidateCommon,
  });

  const bulkAssign = useMutation({
    mutationFn: async ({
      taskIds,
      userId,
    }: {
      taskIds: string[];
      userId: string;
    }) => {
      await bulkOperation({
        taskIds,
        operation: "updateAssignee",
        value: userId,
      });
    },
    onSuccess: invalidateCommon,
  });

  const bulkMoveToBacklog = useMutation({
    mutationFn: async (taskIds: string[]) => {
      await bulkOperation({
        taskIds,
        operation: "updateStatus",
        value: "planned",
      });
    },
    onSuccess: invalidateCommon,
  });

  const bulkMoveToBoard = useMutation({
    mutationFn: async ({
      taskIds,
      status,
    }: {
      taskIds: string[];
      status: string;
    }) => {
      await bulkOperation({
        taskIds,
        operation: "updateStatus",
        value: status,
      });
    },
    onSuccess: invalidateCommon,
  });

  const bulkPriority = useMutation({
    mutationFn: async ({
      taskIds,
      priority,
    }: {
      taskIds: string[];
      priority: string;
    }) => {
      await bulkOperation({
        taskIds,
        operation: "updatePriority",
        value: priority,
      });
    },
    onSuccess: invalidateCommon,
  });

  const bulkAddLabel = useMutation({
    mutationFn: async ({
      taskIds,
      labelId,
    }: {
      taskIds: string[];
      labelId: string;
    }) => {
      await bulkOperation({
        taskIds,
        operation: "addLabel",
        value: labelId,
      });
    },
    onSuccess: () => {
      invalidateCommon();
      queryClientRef.invalidateQueries({ queryKey: ["labels"] });
    },
  });

  const bulkDueDate = useMutation({
    mutationFn: async ({
      taskIds,
      dueDate,
    }: {
      taskIds: string[];
      dueDate: string | null;
    }) => {
      await bulkOperation({
        taskIds,
        operation: "updateDueDate",
        value: dueDate,
      });
    },
    onSuccess: invalidateCommon,
  });

  return {
    bulkDelete: bulkDelete.mutateAsync,
    bulkArchive: bulkArchive.mutateAsync,
    bulkChangeStatus: bulkChangeStatus.mutateAsync,
    bulkAssign: bulkAssign.mutateAsync,
    bulkMoveToBacklog: bulkMoveToBacklog.mutateAsync,
    bulkMoveToBoard: bulkMoveToBoard.mutateAsync,
    bulkPriority: bulkPriority.mutateAsync,
    bulkAddLabel: bulkAddLabel.mutateAsync,
    bulkDueDate: bulkDueDate.mutateAsync,
  };
}
