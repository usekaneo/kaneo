import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono";
import { HttpError } from "@/lib/http-error";

export type ListRepositoriesResponse = InferResponseType<
  (typeof client)["github-integration"]["repositories"][":projectId"]["$get"],
  200
>;

export type RepositoryPage = {
  installationPage: number;
  repositoryPage: number;
};

async function listRepositories(
  projectId: string,
  page: RepositoryPage = { installationPage: 1, repositoryPage: 1 },
): Promise<ListRepositoriesResponse> {
  const response = await client["github-integration"].repositories[
    ":projectId"
  ].$get({
    param: { projectId },
    query: {
      installationPage: String(page.installationPage),
      repositoryPage: String(page.repositoryPage),
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const result = await response.json();
  return result;
}

export default listRepositories;
