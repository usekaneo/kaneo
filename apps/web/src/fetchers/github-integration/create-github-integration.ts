import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono";

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
    const error = await response.text();
    throw new Error(error);
  }

  const result = await response.json();
  return result;
}

export default createGithubIntegration;
