import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

type Task = Extract<
  InferResponseType<(typeof client)["task"][":id"]["$get"]>,
  { id: string }
>;

export default Task;
