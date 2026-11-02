import { useQueries } from "@tanstack/react-query";
import getColumns from "@/fetchers/column/get-columns";
import getProject from "@/fetchers/project/get-project";
import type { AgentProposal } from "@/types/agent";
import type { AgentCreationDestination } from "./agent-creation-destination";

// Reuse project/column caches so every creation is reviewed with readable names.
export function useAgentCreationDestinations(
  workspaceId: string,
  proposals: AgentProposal[],
) {
  const creations = proposals.flatMap((proposal) =>
    proposal.action.type === "task.create"
      ? [{ id: proposal.id, action: proposal.action }]
      : [],
  );
  const projectIds = [
    ...new Set(creations.map((item) => item.action.projectId)),
  ];
  const projects = useQueries({
    queries: projectIds.map((id) => ({
      queryKey: ["projects", workspaceId, id],
      queryFn: () => getProject({ id, workspaceId }),
    })),
  });
  const columns = useQueries({
    queries: projectIds.map((projectId) => ({
      queryKey: ["columns", projectId],
      queryFn: () => getColumns(projectId),
    })),
  });

  return new Map<string, AgentCreationDestination>(
    creations.map((proposal) => {
      const index = projectIds.indexOf(proposal.action.projectId);
      const project = projects[index]!;
      const statuses = columns[index]!;
      const projectName = project.data?.name;
      const statusName = statuses.data?.find(
        (column) => column.slug === proposal.action.status,
      )?.name;
      return [
        proposal.id,
        {
          projectName,
          statusName,
          pending: project.isPending || statuses.isPending,
          ready:
            !project.isError &&
            !statuses.isError &&
            Boolean(projectName && statusName),
        },
      ];
    }),
  );
}
