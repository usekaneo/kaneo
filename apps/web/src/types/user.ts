import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono";

export type User = InferResponseType<typeof client.me.$get>;

export type LoggedInUser = {
  name: string;
  id: string;
  email: string;
};
