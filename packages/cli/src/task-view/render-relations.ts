import type {
  RelatedTaskJson,
  RelationJson,
} from "../relations/group-relations.js";
import { relationHeading } from "../relations/relation-types.js";
import { type Cell, text } from "../render/cell.js";
import { renderTable } from "../render/table.js";
import type { Ui } from "../render/ui.js";
import { relatedTaskColumns } from "./related-task-columns.js";
import { sectionTitle } from "./section-title.js";

type RelationRow = {
  readonly heading: string | null;
  readonly task: RelatedTaskJson;
};

function relationRows(relations: ReadonlyArray<RelationJson>): RelationRow[] {
  return relations.map((relation, index) => ({
    heading:
      relations[index - 1]?.type === relation.type
        ? null
        : relationHeading(relation.type),
    task: relation.task,
  }));
}

export function renderRelations(
  ui: Ui,
  relations: ReadonlyArray<RelationJson>,
): string[] {
  if (relations.length === 0) return [];
  return [
    sectionTitle(ui, "Relations"),
    ...renderTable(
      ui,
      relationRows(relations),
      [
        {
          header: "Type",
          cell: (row): Cell =>
            row.heading ? [text(row.heading, ui.theme.muted)] : [],
        },
        ...relatedTaskColumns(ui, (row: RelationRow) => row.task),
      ],
      { width: ui.caps.columns, indent: 4, gap: 2 },
    ),
    "",
  ];
}
