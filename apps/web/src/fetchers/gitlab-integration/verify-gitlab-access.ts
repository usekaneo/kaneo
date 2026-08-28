import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";

export type VerifyGitlabAccessRequest = InferRequestType<
  (typeof client)["gitlab-integration"]["verify"]["$post"]
>["json"];

export type VerifyGitlabAccessResponse = InferResponseType<
  (typeof client)["gitlab-integration"]["verify"]["$post"],
  200
>;

async function verifyGitlabAccess(
  data: VerifyGitlabAccessRequest,
): Promise<VerifyGitlabAccessResponse> {
  const response = await client["gitlab-integration"].verify.$post({
    json: data,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Request failed" }));
    throw new Error(
      typeof error === "object" && error && "message" in error
        ? String((error as { message: string }).message)
        : "Request failed",
    );
  }

  return response.json();
}

export default verifyGitlabAccess;
