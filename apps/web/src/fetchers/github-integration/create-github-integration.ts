import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono";
import { HttpError } from "@/lib/http-error";

export type CreateGithubIntegrationRequest = InferRequestType<
  (typeof client)["github-integration"]["project"][":projectId"]["$post"]
>["json"];

async function createGithubIntegration(
  projectId: string,
  data: CreateGithubIntegrationRequest,
) {
  const response = await client["github-integration"].project[
    ":projectId"
  ].$post({
    param: { projectId },
    json: data,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const result = await response.json();
  return result;
}

export default createGithubIntegration;
