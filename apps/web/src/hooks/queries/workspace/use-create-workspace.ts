import createWorkspace, {
  type CreateWorkspaceRequest,
} from "@/fetchers/workspace/create-workspace";
import { useMutation } from "@tanstack/react-query";

function useCreateWorkspace() {
  return useMutation({
    mutationFn: ({ name, description }: CreateWorkspaceRequest) =>
      createWorkspace({ name, description }),
  });
}

export default useCreateWorkspace;
