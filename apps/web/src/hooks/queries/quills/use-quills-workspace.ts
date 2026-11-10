import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import getQuillsWorkspaceContext from "@/fetchers/quills/get-workspace-context";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { authClient } from "@/lib/auth-client";
import { isUnauthorizedError } from "@/lib/http-error";
import { isForbiddenOrNotFound } from "@/lib/is-forbidden-or-not-found";

export default function useQuillsWorkspace() {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id;
  const { data: workspace, isLoading, isError } = useActiveWorkspace();
  const routeWorkspaceId = useParams({
    strict: false,
    select: (params) =>
      "workspaceId" in params ? params.workspaceId : undefined,
  });
  const { canReadQuills } = useWorkspacePermission();
  const allowed = Boolean(
    !isPending &&
    userId &&
    !isLoading &&
    !isError &&
    workspace?.id &&
    (!routeWorkspaceId || routeWorkspaceId === workspace.id) &&
    canReadQuills(),
  );
  const query = useQuery({
    queryKey: [
      "quills-context",
      userId,
      workspace?.id,
      workspace?.name,
      workspace?.slug,
    ],
    enabled: allowed,
    queryFn: () => getQuillsWorkspaceContext(workspace!.id),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const denied =
    isUnauthorizedError(query.error) || isForbiddenOrNotFound(query.error);
  return {
    ...query,
    data:
      allowed && !denied && query.data?.actor.userId === userId
        ? query.data
        : undefined,
  };
}
