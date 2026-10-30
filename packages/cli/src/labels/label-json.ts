import type { Label } from "../api/labels.js";

export type LabelJson = {
  readonly id: string;
  readonly name: string;
  readonly color: string;
};

export type TaskLabelJson = {
  readonly name: string;
  readonly color: string;
};

export function toLabelJson(label: Label): LabelJson {
  return { id: label.id, name: label.name, color: label.color };
}

export function toTaskLabelJson(label: Label): TaskLabelJson {
  return { name: label.name, color: label.color };
}
