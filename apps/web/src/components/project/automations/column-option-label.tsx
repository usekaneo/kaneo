import type { ProjectColumn } from "@/components/project/columns/types";
import { getColumnIcon } from "@/lib/column";

export function ColumnOptionLabel({ column }: { column: ProjectColumn }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {getColumnIcon(column.slug, column.isFinal, column.icon)}
      <span className="truncate">{column.name}</span>
    </span>
  );
}
