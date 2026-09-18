import { client } from "@kaneo/libs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType } from "hono/client";
import type { PersonTask } from "@/fetchers/people/get-person-tasks";

type Priority = InferRequestType<
  (typeof client)["task"]["priority"][":id"]["$put"]
>["json"]["priority"];

type Change =
  | { field: "status"; value: string; label?: string; isFinal?: boolean }
  | { field: "priority"; value: Priority };

async function send(taskId: string, change: Change) {
  const response =
    change.field === "status"
      ? await client.task.status[":id"].$put({
          param: { id: taskId },
          json: { status: change.value },
        })
      : await client.task.priority[":id"].$put({
          param: { id: taskId },
          json: { priority: change.value },
        });
  if (!response.ok) throw new Error(await response.text());
}

/** Status and priority edits straight from a person's task list. */
function useInlineTaskUpdate(workspaceId: string, userId: string) {
  const queryClient = useQueryClient();
  const listKey = ["people", workspaceId, userId, "tasks"];

  return useMutation({
    mutationFn: ({ task, change }: { task: PersonTask; change: Change }) =>
      send(task.id, change),
    onMutate: async ({ task, change }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<PersonTask[]>(listKey);
      queryClient.setQueryData<PersonTask[]>(listKey, (tasks) =>
        tasks?.map((t) =>
          t.id !== task.id
            ? t
            : change.field === "priority"
              ? { ...t, priority: change.value }
              : {
                  ...t,
                  status: change.value,
                  statusName: change.label ?? t.statusName,
                  done: change.isFinal ?? t.done,
                },
        ),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(listKey, context.previous);
    },
    onSettled: (_data, _error, { task }) => {
      void queryClient.invalidateQueries({ queryKey: ["people", workspaceId] });
      void queryClient.invalidateQueries({
        queryKey: ["tasks", task.projectId],
      });
      void queryClient.invalidateQueries({ queryKey: ["task", task.id] });
    },
  });
}

export default useInlineTaskUpdate;
