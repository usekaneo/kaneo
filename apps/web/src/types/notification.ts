import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type Notification = Extract<
  InferResponseType<(typeof client)["notification"]["$get"]>[number],
  { id: string }
>;

export type NotificationEventData = Record<string, unknown> | null | undefined;
