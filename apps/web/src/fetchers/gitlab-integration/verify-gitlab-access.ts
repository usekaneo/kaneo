import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";
import { HttpError } from "@/lib/http-error";

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
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default verifyGitlabAccess;
