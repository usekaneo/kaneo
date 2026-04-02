import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type MyTasksResponse = InferResponseType<
  (typeof client)["task"]["tasks"]["workspace"][":workspaceId"]["my"]["$get"],
  200
>;

export type MyTaskSummary = MyTasksResponse["summary"];
export type MyTaskGroup = MyTasksResponse["groups"][number];
export type MyTask = MyTaskGroup["tasks"][number];
