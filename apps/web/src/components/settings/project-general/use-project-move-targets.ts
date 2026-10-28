import { useMemo } from "react";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import { useWorkspacesWithPermission } from "@/hooks/queries/workspace/use-workspaces-with-permission";
import type { ProjectWithTasks } from "@/types/project";

const PROJECT_MOVE_TARGET = {
  project: ["create"],
  workspace: ["manage_settings"],
};
const PROJECT_UPDATE_AND_DELETE = { project: ["update", "delete"] };

export function useProjectMoveTargets(
  project: ProjectWithTasks | undefined,
  isCurrentProject: boolean,
) {
  const { data: workspaces } = useGetWorkspaces();
  const moveCandidates = useMemo(
    () => (workspaces ?? []).filter((item) => item.id !== project?.workspaceId),
    [workspaces, project?.workspaceId],
  );
  const moveCandidateIds = useMemo(
    () => moveCandidates.map((item) => item.id),
    [moveCandidates],
  );
  const { allowed: canMoveInto, isError: moveTargetsFailed } =
    useWorkspacesWithPermission(moveCandidateIds, PROJECT_MOVE_TARGET);
  const moveTargets = useMemo(
    () => moveCandidates.filter((item) => canMoveInto.has(item.id)),
    [moveCandidates, canMoveInto],
  );
  const sourceWorkspaceIds = useMemo(
    () => (project?.workspaceId ? [project.workspaceId] : []),
    [project?.workspaceId],
  );
  const { allowed: canMoveOutOfSource } = useWorkspacesWithPermission(
    sourceWorkspaceIds,
    PROJECT_UPDATE_AND_DELETE,
  );
  const canMoveFromSource = Boolean(
    project?.workspaceId && canMoveOutOfSource.has(project.workspaceId),
  );
  const canShowMove =
    canMoveFromSource &&
    isCurrentProject &&
    (moveTargets.length > 0 || moveTargetsFailed);

  return { moveTargets, moveTargetsFailed, canShowMove };
}
