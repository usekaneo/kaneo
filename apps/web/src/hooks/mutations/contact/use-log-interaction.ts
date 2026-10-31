import { useMutation, useQueryClient } from "@tanstack/react-query";
import createActivity from "@/fetchers/activity/create-activity";
import { useUpdateTaskDueDate } from "@/hooks/mutations/task/use-update-task-due-date";
import type Task from "@/types/task";

type LogInteractionInput = {
  lead: { id: string; projectId: string };
  note: string;
  // ISO date-time for the next follow-up; omit to leave the lead's date alone.
  nextFollowUp?: string;
};

// An interaction is a comment on the lead, so it also shows in the task itself.
export function useLogInteraction(workspaceId: string, contactId: string) {
  const queryClient = useQueryClient();
  const { mutateAsync: updateDueDate } = useUpdateTaskDueDate();

  return useMutation({
    mutationFn: async ({ lead, note, nextFollowUp }: LogInteractionInput) => {
      await createActivity({ taskId: lead.id, comment: note });
      if (nextFollowUp) {
        await updateDueDate({
          id: lead.id,
          projectId: lead.projectId,
          dueDate: nextFollowUp,
        } as Task);
      }
    },
    onSettled: (_data, _error, { lead }) => {
      queryClient.invalidateQueries({
        queryKey: ["contacts", workspaceId, "timeline", contactId],
      });
      queryClient.invalidateQueries({ queryKey: ["activities", lead.id] });
      queryClient.invalidateQueries({ queryKey: ["workspace-activity"] });
    },
  });
}
