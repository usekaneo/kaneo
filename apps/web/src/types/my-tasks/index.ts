import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import type Task from "@/types/task";

type AssignedTasksApiResponse = InferResponseType<
  (typeof client)["user"]["tasks"]["$get"],
  200
>;

type AssignedTasksRaw = AssignedTasksApiResponse["data"];

export type AssignedTaskProject = AssignedTasksRaw["projects"][number];

export type AssignedTasksData = Omit<AssignedTasksRaw, "tasks"> & {
  tasks: Task[];
};
