import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";

export type ListGitlabRepositoriesRequest = InferRequestType<
  (typeof client)["gitlab-integration"]["repositories"]["$post"]
>["json"];

export type ListGitlabRepositoriesResponse = InferResponseType<
  (typeof client)["gitlab-integration"]["repositories"]["$post"],
  200
>;

async function listGitlabRepositories(
  data: ListGitlabRepositoriesRequest,
): Promise<ListGitlabRepositoriesResponse> {
  const response = await client["gitlab-integration"].repositories.$post({
    json: data,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || "Request failed");
  }

  return response.json();
}

export default listGitlabRepositories;
