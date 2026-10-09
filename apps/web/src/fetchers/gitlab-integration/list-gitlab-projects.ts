import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";
import { HttpError } from "@/lib/http-error";

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
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default listGitlabProjects;
