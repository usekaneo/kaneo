import type { Ui } from "../render/ui.js";
import { renderComments } from "./render-comments.js";
import { renderFields } from "./render-fields.js";
import { renderLinks } from "./render-links.js";
import { renderRelations } from "./render-relations.js";
import { renderSubtasks } from "./render-subtasks.js";
import { failedSection } from "./section-title.js";
import type { TaskViewJson } from "./task-view-json.js";

export type TaskSectionsView = {
  readonly task: TaskViewJson;
  readonly commentTotal: number;
  readonly now: Date;
  readonly full?: boolean;
};

export function renderTaskSections(ui: Ui, view: TaskSectionsView): string[] {
  const { task } = view;
  return [
    ...(task.subtasks === null
      ? failedSection(ui, "Relations")
      : [
          ...renderSubtasks(ui, task.subtasks),
          ...renderRelations(ui, task.relations ?? []),
        ]),
    ...(task.links === null
      ? failedSection(ui, "Links")
      : renderLinks(ui, task.links)),
    ...(task.fields === null
      ? failedSection(ui, "Custom fields")
      : renderFields(ui, task.fields)),
    ...(task.comments === null
      ? failedSection(ui, "Comments")
      : renderComments(ui, {
          comments: task.comments,
          total: view.commentTotal,
          reference: task.ticketId ?? task.id,
          now: view.now,
          full: view.full ?? false,
        })),
  ];
}
