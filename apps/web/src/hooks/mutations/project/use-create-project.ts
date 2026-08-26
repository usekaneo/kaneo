import { useMutation } from "@tanstack/react-query";
import type { ProjectTypeKey } from "@/constants/project-types";
import createProject from "@/fetchers/project/create-project";

function useCreateProject({
  name,
  slug,
  workspaceId,
  icon,
  clientId,
  projectType,
}: {
  name: string;
  slug: string;
  workspaceId: string;
  icon: string;
  clientId?: string | null;
  projectType?: ProjectTypeKey;
}) {
  return useMutation({
    mutationFn: () =>
      createProject({
        name,
        slug,
        workspaceId,
        icon,
        clientId,
        projectType,
      }),
  });
}

export default useCreateProject;
