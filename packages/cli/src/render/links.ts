export function taskUrl(
  webUrl: string,
  task: {
    readonly workspaceId: string;
    readonly projectId: string;
    readonly id: string;
  },
): string {
  return `${webUrl}/dashboard/workspace/${task.workspaceId}/project/${task.projectId}/task/${task.id}`;
}

export function projectUrl(
  webUrl: string,
  project: { readonly workspaceId: string; readonly id: string },
): string {
  return `${webUrl}/dashboard/workspace/${project.workspaceId}/project/${project.id}/board`;
}
