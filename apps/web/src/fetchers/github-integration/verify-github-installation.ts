import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";
import { HttpError } from "@/lib/http-error";

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
    throw new HttpError(
      response.status,
      (await response.text()) || "Request failed",
    );
  }

  const result = await response.json();

  return result;
}

export default verifyGithubInstallation;
