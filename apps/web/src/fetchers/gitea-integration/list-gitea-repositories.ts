import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";
import { HttpError } from "@/lib/http-error";

export type ListGiteaRepositoriesRequest = InferRequestType<
  (typeof client)["gitea-integration"]["repositories"]["$post"]
>["json"];

export type ListGiteaRepositoriesResponse = InferResponseType<
  (typeof client)["gitea-integration"]["repositories"]["$post"],
  200
>;

async function listGiteaRepositories(
  data: ListGiteaRepositoriesRequest,
): Promise<ListGiteaRepositoriesResponse> {
  const response = await client["gitea-integration"].repositories.$post({
    json: data,
  });

  if (!response.ok) {
    throw new HttpError(
      response.status,
      (await response.text()) || "Request failed",
    );
  }

  return response.json();
}

export default listGiteaRepositories;
