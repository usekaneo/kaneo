import type { projectAccessApi } from "./project-access-api";

export function putMemberProjectAccess(
  request: ReturnType<typeof projectAccessApi>,
  workspaceId: string,
  userId: string,
  body: { projectAccess: string; projectIds?: string[] },
) {
  return request(`/workspace/${workspaceId}/members/${userId}/project-access`, {
    method: "PUT",
    body,
  });
}
