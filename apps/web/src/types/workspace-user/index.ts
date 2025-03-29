import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type WorkspaceUser = NonNullable<
  InferResponseType<(typeof client)["workspace-user"]["$get"]>
>[number];

export default WorkspaceUser;
