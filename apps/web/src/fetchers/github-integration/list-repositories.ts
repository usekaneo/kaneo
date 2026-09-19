import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono";
import { HttpError } from "@/lib/http-error";

export type ListRepositoriesResponse = InferResponseType<
  (typeof client)["github-integration"]["repositories"][":projectId"]["$get"],
  200
>;

async function listRepositories(
  projectId: string,
): Promise<ListRepositoriesResponse> {
  const response = await client["github-integration"].repositories[
    ":projectId"
  ].$get({
    param: { projectId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const result = await response.json();
  return result;
}

export default listRepositories;
