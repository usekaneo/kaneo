import type { api } from "@kaneo/libs";
import type ApiResponse from "./api-response";

export type User = NonNullable<ApiResponse<typeof api.me.get>> | undefined;

export type LoggedInUser = {
  name: string;
  id: string;
  email: string;
};
