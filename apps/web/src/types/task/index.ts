import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

type Task = InferResponseType<(typeof client)["task"][":id"]["$get"]>;

export default Task;
