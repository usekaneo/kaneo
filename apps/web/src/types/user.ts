import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono";

export type User = Extract<
  InferResponseType<typeof client.me.$get>,
  { user: { id: string } }
>["user"];

export type LoggedInUser = {
  name: string;
  id: string;
  email: string;
};
