import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ConnectStorageRequest, filesApi } from "@/fetchers/files";

export function useFiles(workspaceId: string, folder: string) {
  return useQuery({
    queryKey: ["files", workspaceId, folder],
    queryFn: () => filesApi.list(workspaceId, folder),
  });
}

export function useFileStorage(
  workspaceId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["files", "storage", workspaceId],
    queryFn: () => filesApi.storage(workspaceId as string),
    enabled: !!workspaceId && enabled,
  });
}

export function useAllFolders(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["files", workspaceId, "all-folders"],
    queryFn: () => filesApi.allFolders(workspaceId),
    enabled,
  });
}

export function useFileActions(workspaceId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () =>
    queryClient.invalidateQueries({ queryKey: ["files", workspaceId] });
  return {
    upload: useMutation({
      mutationFn: ({
        file,
        folder,
        onProgress,
      }: {
        file: File;
        folder: string;
        onProgress?: (fraction: number) => void;
      }) => filesApi.upload(workspaceId, file, folder, onProgress),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        ...changes
      }: {
        id: string;
        filename?: string;
        folder?: string;
      }) => filesApi.update(workspaceId, id, changes),
      onSuccess,
    }),
    share: useMutation({
      mutationFn: (id: string) => filesApi.share(workspaceId, id),
      onSuccess,
    }),
    unshare: useMutation({
      mutationFn: (id: string) => filesApi.unshare(workspaceId, id),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: string) => filesApi.remove(workspaceId, id),
      onSuccess,
    }),
    createFolder: useMutation({
      mutationFn: ({ parent, name }: { parent: string; name: string }) =>
        filesApi.createFolder(workspaceId, parent, name),
      onSuccess,
    }),
    moveFolder: useMutation({
      mutationFn: ({ from, to }: { from: string; to: string }) =>
        filesApi.moveFolder(workspaceId, from, to),
      onSuccess,
    }),
    deleteFolder: useMutation({
      mutationFn: (path: string) => filesApi.deleteFolder(workspaceId, path),
      onSuccess,
    }),
  };
}

export function useStorageActions(workspaceId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () =>
    queryClient.invalidateQueries({
      queryKey: ["files", "storage", workspaceId],
    });
  return {
    connect: useMutation({
      mutationFn: (json: ConnectStorageRequest) => filesApi.connect(json),
      onSuccess,
    }),
    disconnect: useMutation({
      mutationFn: () => filesApi.disconnect(workspaceId),
      onSuccess,
    }),
  };
}
