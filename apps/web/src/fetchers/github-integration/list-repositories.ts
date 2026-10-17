import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono";
import { HttpError } from "@/lib/http-error";

export type ListRepositoriesResponse = InferResponseType<
  (typeof client)["github-integration"]["repositories"][":projectId"]["$get"],
  200
>;

export type GithubRepository = ListRepositoriesResponse["repositories"][number];

export type RepositoryPage = {
  installationPage: number;
  repositoryPage: number;
};

export const FIRST_REPOSITORY_PAGE: RepositoryPage = {
  installationPage: 1,
  repositoryPage: 1,
};

async function listRepositories(
  projectId: string,
  page: RepositoryPage = FIRST_REPOSITORY_PAGE,
  search?: string,
): Promise<ListRepositoriesResponse> {
  const term = search?.trim();
  const response = await client["github-integration"].repositories[
    ":projectId"
  ].$get({
    param: { projectId },
    query: {
      installationPage: String(page.installationPage),
      repositoryPage: String(page.repositoryPage),
      ...(term ? { search: term } : {}),
    },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default listRepositories;
