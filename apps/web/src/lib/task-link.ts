import { createSlug } from "@/lib/utils/create-slug";
import { isReservedWorkspaceSlug } from "@/lib/utils/create-workspace-slug";

const MAX_TITLE_SLUG_LENGTH = 60;
const MAX_LOOKUP_VALUE_LENGTH = 128;

type TaskPathInput = {
  workspaceId: string;
  workspace?: { id: string; slug?: string | null } | null;
  projectId: string;
  workspaceProjects?: { id: string; slug: string }[];
  taskId: string;
  taskNumber?: number | null;
  title?: string | null;
};

function isLinkSegment(value: string) {
  return (
    value.length <= MAX_LOOKUP_VALUE_LENGTH &&
    /^[\p{L}\p{N}\p{M}._~-]+$/u.test(value)
  );
}

function getUniqueProjectKey(
  projects: { id: string; slug: string }[],
  projectId: string,
) {
  const key = projects.find((project) => project.id === projectId)?.slug;
  if (!key) return undefined;

  const normalizedKey = key.normalize("NFKC").toLowerCase();
  const sharesKey = projects.some(
    (project) =>
      project.id !== projectId &&
      project.slug.normalize("NFKC").toLowerCase() === normalizedKey,
  );
  return sharesKey ? undefined : key;
}

export function getTaskPath({
  workspaceId,
  workspace,
  projectId,
  workspaceProjects = [],
  taskId,
  taskNumber,
  title,
}: TaskPathInput) {
  const fullPath = `/dashboard/workspace/${workspaceId}/project/${projectId}/task/${taskId}`;
  const workspaceSlug =
    workspace?.id === workspaceId ? workspace.slug : undefined;
  const projectKey = getUniqueProjectKey(workspaceProjects, projectId);
  if (
    !workspaceSlug ||
    !projectKey ||
    !taskNumber ||
    !isLinkSegment(workspaceSlug) ||
    isReservedWorkspaceSlug(workspaceSlug)
  ) {
    return fullPath;
  }

  const ticketId = `${projectKey}-${taskNumber}`;
  if (!isLinkSegment(ticketId)) return fullPath;

  const titleSlug = createSlug(title ?? "")
    .slice(0, MAX_TITLE_SLUG_LENGTH)
    .replace(/-+$/, "");

  return `/${workspaceSlug}/task/${ticketId}${titleSlug ? `/${titleSlug}` : ""}`;
}
