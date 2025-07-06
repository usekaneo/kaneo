import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

type Task = Extract<
  InferResponseType<
    (typeof client)["task"]["tasks"][":projectId"]["$get"]
  >["columns"][number]["tasks"][number],
  { id: string }
>;

export default Task;
