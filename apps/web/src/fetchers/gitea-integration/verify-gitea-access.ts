import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";
import { HttpError } from "@/lib/http-error";

export type VerifyGiteaAccessRequest = InferRequestType<
  (typeof client)["gitea-integration"]["verify"]["$post"]
>["json"];

export type VerifyGiteaAccessResponse = InferResponseType<
  (typeof client)["gitea-integration"]["verify"]["$post"],
  200
>;

async function verifyGiteaAccess(
  data: VerifyGiteaAccessRequest,
): Promise<VerifyGiteaAccessResponse> {
  const response = await client["gitea-integration"].verify.$post({
    json: data,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default verifyGiteaAccess;
