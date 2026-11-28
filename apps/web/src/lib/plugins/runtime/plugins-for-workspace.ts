import type { RuntimePlugin } from "./select-contributions";

export function pluginsForWorkspace(
  plugins: readonly RuntimePlugin[],
  workspaceId: string,
  ownerWorkspaceId: string | undefined,
): readonly RuntimePlugin[] {
  if (ownerWorkspaceId !== workspaceId) return [];
  return plugins.filter((runtime) => runtime.scope.workspaceId === workspaceId);
}
