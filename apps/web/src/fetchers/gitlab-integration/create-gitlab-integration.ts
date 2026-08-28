import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono";

export type CreateGitlabIntegrationRequest = InferRequestType<
  (typeof client)["gitlab-integration"]["project"][":projectId"]["$post"]
>["json"];

async function createGitlabIntegration(
  projectId: string,
  data: CreateGitlabIntegrationRequest,
) {
  const response = await client["gitlab-integration"].project[
    ":projectId"
  ].$post({
    param: { projectId },
    json: data,
  });

  if (!response.ok) {
    const error = await response
      .clone()
      .json()
      .catch(async () => ({
        message: (await response.text()) || "Request failed",
      }));
    throw new Error(
      typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "Request failed",
    );
  }

  return response.json();
}

export default createGitlabIntegration;
