import type { Workspace } from "../../api/schemas.js";

export type WorkspaceJson = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly role: string | null;
  readonly description: string | null;
  readonly active: boolean;
};

export function toWorkspaceJson(
  workspace: Workspace,
  activeId: string | undefined,
): WorkspaceJson {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    role: workspace.role,
    description: workspace.description,
    active: workspace.id === activeId,
  };
}
