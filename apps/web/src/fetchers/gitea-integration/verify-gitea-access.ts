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
    const error = await response
      .clone()
      .json()
      .catch(async () => ({
        message: (await response.text()) || "Request failed",
      }));
    throw new HttpError(
      response.status,
      typeof error === "object" && error && "message" in error
        ? String((error as { message: string }).message)
        : "Request failed",
    );
  }

  return response.json();
}

export default verifyGiteaAccess;
