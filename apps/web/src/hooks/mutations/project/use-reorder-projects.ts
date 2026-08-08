import { useMutation, useQueryClient } from "@tanstack/react-query";
import type getProjects from "@/fetchers/project/get-projects";
import reorderProjects from "@/fetchers/project/reorder-projects";

type ProjectList = Awaited<ReturnType<typeof getProjects>>;

type ReorderProjectsVariables = {
  workspaceId: string;
  projects: Array<{ id: string; position: number }>;
};

function useReorderProjects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, projects }: ReorderProjectsVariables) =>
      reorderProjects(workspaceId, projects),
    // Reordering is a pure UI gesture — without an optimistic write the list
    // snaps back to the server order until the refetch lands.
    onMutate: async ({ workspaceId, projects }: ReorderProjectsVariables) => {
      const queryKey = ["projects", workspaceId];
      await queryClient.cancelQueries({ queryKey });

      const previousProjects = queryClient.getQueryData<ProjectList>(queryKey);

      if (previousProjects) {
        const positionById = new Map(
          projects.map(({ id, position }) => [id, position]),
        );

        queryClient.setQueryData<ProjectList>(
          queryKey,
          [...previousProjects].sort(
            (a, b) =>
              (positionById.get(a.id) ?? a.position) -
              (positionById.get(b.id) ?? b.position),
          ),
        );
      }

      return { queryKey, previousProjects };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(context.queryKey, context.previousProjects);
      }
    },
    onSettled: (_data, _error, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
    },
  });
}

export default useReorderProjects;
