import type { PluginProject } from "@kaneo/plugin-sdk/web";

type ProjectSource = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  columns: Array<{
    id: string;
    name: string;
    slug: string;
    isFinal: boolean | null;
  }>;
};

type ColumnLabel = (slug: string, name: string) => string;

export function toPluginProject(
  project: ProjectSource,
  columnLabel: ColumnLabel = (_slug, name) => name,
): PluginProject {
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    name: project.name,
    slug: project.slug,
    columns: project.columns.map((column) => ({
      id: column.id,
      name: columnLabel(column.slug, column.name),
      slug: column.slug,
      isFinal: column.isFinal === true,
    })),
  };
}
