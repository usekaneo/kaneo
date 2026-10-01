import { createSlug } from "@/lib/utils/create-slug";
import { isReservedWorkspaceSlug } from "@/lib/utils/create-workspace-slug";

const MAX_TITLE_SLUG_LENGTH = 60;

type TaskPathInput = {
  workspaceId: string;
  workspaceSlug?: string | null;
  projectId: string;
  workspaceProjects?: { id: string; slug: string }[];
  taskId: string;
  taskNumber?: number | null;
  title?: string | null;
};

function getUniqueProjectKey(
  projects: { id: string; slug: string }[],
  projectId: string,
) {
  const key = projects.find((project) => project.id === projectId)?.slug;
  if (!key) return undefined;

  const sharesKey = projects.some(
    (project) =>
      project.id !== projectId &&
      project.slug.toLowerCase() === key.toLowerCase(),
  );
  return sharesKey ? undefined : key;
}

export function getTaskPath({
  workspaceId,
  workspaceSlug,
  projectId,
  workspaceProjects = [],
  taskId,
  taskNumber,
  title,
}: TaskPathInput) {
  const projectKey = getUniqueProjectKey(workspaceProjects, projectId);
  if (
    !workspaceSlug ||
    !projectKey ||
    !taskNumber ||
    isReservedWorkspaceSlug(workspaceSlug)
  ) {
    return `/dashboard/workspace/${workspaceId}/project/${projectId}/task/${taskId}`;
  }

  const ticketId = `${projectKey}-${taskNumber}`.replace(
    /[^\p{L}\p{N}\p{M}._~-]/gu,
    (character) => encodeURIComponent(character),
  );
  const titleSlug = createSlug(title ?? "")
    .slice(0, MAX_TITLE_SLUG_LENGTH)
    .replace(/-+$/, "");

  return `/${encodeURIComponent(workspaceSlug)}/task/${ticketId}${titleSlug ? `/${titleSlug}` : ""}`;
}
