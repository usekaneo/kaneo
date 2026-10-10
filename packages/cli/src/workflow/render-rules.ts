import { type Cell, text } from "../render/cell.js";
import { renderTable } from "../render/table.js";
import { statusDot } from "../render/task-format.js";
import type { Ui } from "../render/ui.js";
import { eventLabel, integrationLabel } from "./events.js";
import type { RuleJson } from "./rule-json.js";

function columnCell(ui: Ui, rule: RuleJson): Cell {
  if (!rule.column.name) {
    return [text("missing column", ui.theme.danger)];
  }
  return [
    statusDot(ui, rule.column.slug ?? "", false),
    text(` ${rule.column.name}`),
  ];
}

export function renderRuleList(
  ui: Ui,
  view: {
    readonly projectName: string;
    readonly rules: ReadonlyArray<RuleJson>;
  },
): string[] {
  const { theme, glyphs } = ui;
  if (view.rules.length === 0) {
    return [
      "",
      `  ${theme.muted(`No workflow rules in ${view.projectName}. Integrations use their default columns.`)}`,
      `  ${theme.muted("Add one with kaneo workflow set github pr_merged done.")}`,
      "",
    ];
  }
  return [
    "",
    ...renderTable(
      ui,
      view.rules,
      [
        {
          header: "Integration",
          cell: (rule): Cell => [
            text(integrationLabel(rule.integration), theme.strong),
          ],
        },
        {
          header: "Event",
          flex: true,
          minWidth: 12,
          cell: (rule): Cell => [text(eventLabel(rule.event))],
        },
        {
          header: "",
          cell: (): Cell => [text(glyphs.arrow, theme.muted)],
        },
        {
          header: "Column",
          flex: true,
          minWidth: 8,
          cell: (rule): Cell => columnCell(ui, rule),
        },
        {
          header: "Key",
          optional: true,
          cell: (rule): Cell => [
            text(`${rule.integration} ${rule.event}`, theme.muted),
          ],
        },
      ],
      { width: ui.caps.columns, indent: 2 },
    ),
    "",
  ];
}

export function renderRuleChange(
  ui: Ui,
  change: { readonly verb: "Set" | "Deleted"; readonly rule: RuleJson },
): string[] {
  const { theme, glyphs } = ui;
  const name = `${integrationLabel(change.rule.integration)} ${eventLabel(change.rule.event).toLowerCase()}`;
  const column = change.rule.column.name ?? change.rule.column.id;
  return [
    "",
    change.verb === "Set"
      ? `  ${theme.success(glyphs.tick)} ${theme.strong(name)} ${theme.muted(glyphs.arrow)} moves tasks to ${theme.strong(column)}`
      : `  ${theme.success(glyphs.tick)} Deleted the rule ${theme.strong(name)} ${theme.muted(`${glyphs.separator} was ${column}`)}`,
    "",
  ];
}
