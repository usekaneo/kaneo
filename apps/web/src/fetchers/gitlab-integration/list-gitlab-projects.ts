import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";

export type ListGitlabProjectsRequest = InferRequestType<
  (typeof client)["gitlab-integration"]["projects"]["$post"]
>["json"];

export type ListGitlabProjectsResponse = InferResponseType<
  (typeof client)["gitlab-integration"]["projects"]["$post"],
  200
>;

async function listGitlabProjects(
  data: ListGitlabProjectsRequest,
): Promise<ListGitlabProjectsResponse> {
  const response = await client["gitlab-integration"].projects.$post({
    json: data,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || "Request failed");
  }

  return response.json();
}

export default listGitlabProjects;
