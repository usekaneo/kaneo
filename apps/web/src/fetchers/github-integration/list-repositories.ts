import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono";

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
    const error = await response.text();
    throw new Error(error);
  }

  const result = await response.json();
  return result;
}

export default listRepositories;
