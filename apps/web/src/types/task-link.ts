export type TaskLinkType =
  | "blocks"
  | "blocked_by"
  | "relates_to"
  | "duplicates"
  | "parent"
  | "child";

export interface TaskLink {
  id: string;
  fromTaskId: string;
  toTaskId: string;
  type: TaskLinkType;
  createdAt: string;
  createdBy: string;
  direction: "out" | "in" | "undirected";
}
