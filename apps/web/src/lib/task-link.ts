import { createSlug } from "@/lib/utils/create-slug";
import { isReservedWorkspaceSlug } from "@/lib/utils/create-workspace-slug";

const MAX_TITLE_SLUG_LENGTH = 60;

type TaskPathInput = {
  workspaceId: string;
  workspaceSlug?: string | null;
  projectId: string;
  projectSlug?: string | null;
  taskId: string;
  taskNumber?: number | null;
  title?: string | null;
};

export function getTaskPath({
  workspaceId,
  workspaceSlug,
  projectId,
  projectSlug,
  taskId,
  taskNumber,
  title,
}: TaskPathInput) {
  if (
    !workspaceSlug ||
    !projectSlug ||
    !taskNumber ||
    isReservedWorkspaceSlug(workspaceSlug)
  ) {
    return `/dashboard/workspace/${workspaceId}/project/${projectId}/task/${taskId}`;
  }

  const ticketId = encodeURIComponent(`${projectSlug}-${taskNumber}`);
  const titleSlug = createSlug(title ?? "")
    .slice(0, MAX_TITLE_SLUG_LENGTH)
    .replace(/-+$/, "");

  return `/${encodeURIComponent(workspaceSlug)}/task/${ticketId}${titleSlug ? `/${titleSlug}` : ""}`;
}
