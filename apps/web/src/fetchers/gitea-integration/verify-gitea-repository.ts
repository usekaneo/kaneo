import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";

export type VerifyGiteaRepositoryRequest = InferRequestType<
  (typeof client)["gitea-integration"]["verify"]["$post"]
>["json"];

export type VerifyGiteaRepositoryResponse = InferResponseType<
  (typeof client)["gitea-integration"]["verify"]["$post"]
>;

export async function verifyGiteaRepository(
  data: VerifyGiteaRepositoryRequest,
): Promise<VerifyGiteaRepositoryResponse> {
  const response = await client["gitea-integration"].verify.$post({
    json: data,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const result = await response.json();
  return result;
}
