import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { filesApi } from "@/fetchers/files";
import { taskAttachmentApi } from "@/fetchers/task-attachment";

export const taskAttachmentsKey = (taskId: string) =>
  ["task-attachments", taskId] as const;

export function useTaskAttachments(taskId: string) {
  return useQuery({
    queryKey: taskAttachmentsKey(taskId),
    queryFn: () => taskAttachmentApi.list(taskId),
    enabled: !!taskId,
  });
}

export function useTaskAttachmentActions({
  taskId,
  workspaceId,
  folder,
}: {
  taskId: string;
  workspaceId: string;
  folder: string;
}) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: taskAttachmentsKey(taskId),
    });
    // The My work table shows a count per task, and files land in the library.
    void queryClient.invalidateQueries({ queryKey: ["people", workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ["files", workspaceId] });
  };

  const upload = useMutation({
    mutationFn: async ({
      file,
      onProgress,
    }: {
      file: File;
      onProgress?: (fraction: number) => void;
    }) => {
      const stored = await filesApi.upload(
        workspaceId,
        file,
        folder,
        onProgress,
      );
      return taskAttachmentApi.attachFile(taskId, stored.id);
    },
    onSettled: refresh,
  });

  const addLink = useMutation({
    mutationFn: ({ url, title }: { url: string; title?: string }) =>
      taskAttachmentApi.attachLink(taskId, url, title),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => taskAttachmentApi.remove(taskId, id),
    onSuccess: refresh,
  });

  return { upload, addLink, remove };
}
