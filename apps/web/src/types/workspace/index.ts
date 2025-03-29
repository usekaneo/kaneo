import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type Workspace = InferResponseType<
  (typeof client)["workspace"][":id"]["$get"]
>;

export default Workspace;
