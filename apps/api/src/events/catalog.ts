import type { TaskRef } from "../database/lookups";
import type { labelTable } from "../database/schema";

type LabelRow = typeof labelTable.$inferSelect;

type LabelEvent<Kind extends string> = {
  label: LabelRow;
  projectId: string;
  userId: string;
  type: Kind;
};

export type EventMap = {
  "task.label_created": {
    projectId: string;
    taskId: string;
    userId: string;
    type: "label_created";
  };
  "task.label_assigned": LabelEvent<"label_assigned"> & {
    task: TaskRef;
    taskId: string;
  };
  "task.label_unassigned": LabelEvent<"label_unassigned"> & {
    task: TaskRef;
    taskId: string | null;
  };
  "task.label_deleted": LabelEvent<"label_deleted"> & {
    task: TaskRef | Pick<TaskRef, "id" | "projectId">;
    taskId: string;
  };
};

export type EventName = keyof EventMap;
