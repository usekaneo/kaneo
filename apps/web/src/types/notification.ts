import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type Notification = InferResponseType<
  (typeof client)["notification"]["$get"]
>[number];
