import type { ColumnDetail } from "../api/columns.js";

export type ColumnJson = {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly slug: string;
  readonly position: number;
  readonly icon: string | null;
  readonly color: string | null;
  readonly isFinal: boolean;
  readonly taskCount: number | null;
};

export function toColumnJson(
  column: ColumnDetail,
  taskCount: number | null,
): ColumnJson {
  return {
    id: column.id,
    projectId: column.projectId,
    name: column.name,
    slug: column.slug,
    position: column.position,
    icon: column.icon,
    color: column.color,
    isFinal: column.isFinal,
    taskCount,
  };
}
