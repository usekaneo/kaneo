import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetPublicProjectRequest = InferRequestType<
  (typeof client)["public-project"][":id"]["$get"]
>["param"];

async function getPublicProject({ id }: GetPublicProjectRequest) {
  const response = await client["public-project"][":id"].$get({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default getPublicProject;
