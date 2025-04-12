import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type Project = InferResponseType<
  (typeof client)["project"][":id"]["$get"]
>;

export type ProjectWithTasks = InferResponseType<
  (typeof client)["task"]["tasks"][":projectId"]["$get"]
>;
