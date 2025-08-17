import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";

export type VerifyGithubInstallationRequest = InferRequestType<
  (typeof client)["github-integration"]["verify"]["$post"]
>["json"];

export type VerifyGithubInstallationResponse = InferResponseType<
  (typeof client)["github-integration"]["verify"]["$post"],
  200
>;

async function verifyGithubInstallation(
  data: VerifyGithubInstallationRequest,
): Promise<VerifyGithubInstallationResponse> {
  const response = await client["github-integration"].verify.$post({
    json: data,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Request failed");
  }

  const result = await response.json();

  return result;
}

export default verifyGithubInstallation;
