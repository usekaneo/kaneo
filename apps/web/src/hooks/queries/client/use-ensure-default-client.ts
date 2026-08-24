import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import ensureDefaultClient from "@/fetchers/client/ensure-default-client";

function useEnsureDefaultClient(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const attemptedWorkspaceId = useRef<string | null>(null);
  const { mutate } = useMutation({
    mutationFn: ensureDefaultClient,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  useEffect(() => {
    if (!workspaceId) return;
    if (attemptedWorkspaceId.current === workspaceId) return;
    attemptedWorkspaceId.current = workspaceId;
    mutate({ workspaceId });
  }, [mutate, workspaceId]);
}

export default useEnsureDefaultClient;
