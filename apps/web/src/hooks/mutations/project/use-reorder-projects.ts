import {
  type MutateOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import type getProjects from "@/fetchers/project/get-projects";
import reorderProjects from "@/fetchers/project/reorder-projects";

type ProjectList = NonNullable<Awaited<ReturnType<typeof getProjects>>>;

type ReorderProjectsVariables = {
  workspaceId: string;
  projects: ProjectList;
  previousProjects?: ProjectList;
};

function useReorderProjects() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ workspaceId, projects }: ReorderProjectsVariables) =>
      reorderProjects(
        workspaceId,
        projects.map((project, index) => ({ id: project.id, position: index })),
      ),
    onError: (_error, { workspaceId, previousProjects }) => {
      if (previousProjects) {
        queryClient.setQueryData(["projects", workspaceId], previousProjects);
      }
    },
    onSettled: (_data, _error, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
    },
  });

  // Writes the cache here rather than in `onMutate`, which sits behind an await
  // and lands a render later than dnd-kit's own state clear.
  const reorder = useCallback(
    (
      workspaceId: string,
      orderedProjects: ProjectList,
      options?: MutateOptions<unknown, Error, ReorderProjectsVariables>,
    ) => {
      const queryKey = ["projects", workspaceId];
      const previousProjects = queryClient.getQueryData<ProjectList>(queryKey);

      queryClient.setQueryData<ProjectList>(
        queryKey,
        // Positions rewritten, not just the array order, or a second drag
        // before the refetch sorts new indices against stale ones.
        orderedProjects.map((project, index) => ({
          ...project,
          position: index,
        })),
      );

      // After the write, never before: awaiting an in-flight abort first would
      // paint the old order in the gap.
      queryClient.cancelQueries({ queryKey });

      mutation.mutate(
        { workspaceId, projects: orderedProjects, previousProjects },
        options,
      );
    },
    [queryClient, mutation],
  );

  return reorder;
}

export default useReorderProjects;
