import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import type Task from "@/types/task";

export type Project = Extract<
  InferResponseType<(typeof client)["project"][":id"]["$get"], 200>,
  { id: string }
>;

type ProjectWithTasksRaw = Extract<
  InferResponseType<
    (typeof client)["task"]["tasks"][":projectId"]["$get"],
    200
  >,
  { id: string }
>;

export type ProjectWithTasks = Omit<
  ProjectWithTasksRaw,
  "archivedTasks" | "columns" | "plannedTasks"
> & {
  archivedTasks: Task[];
  columns: Array<
    Omit<ProjectWithTasksRaw["columns"][number], "tasks"> & {
      tasks: Task[];
    }
  >;
  plannedTasks: Task[];
};
