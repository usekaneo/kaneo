import type { Ui } from "../render/ui.js";
import {
  renderTaskDetail,
  type TaskDetailView,
} from "../tasks/render-task-detail.js";
import { renderTaskSections } from "./render-task-sections.js";

export type TaskView = TaskDetailView & { readonly commentTotal: number };

export function renderTaskView(ui: Ui, view: TaskView): string[] {
  return [...renderTaskDetail(ui, view), ...renderTaskSections(ui, view)];
}
