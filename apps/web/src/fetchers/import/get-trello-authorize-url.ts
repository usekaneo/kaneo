import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono";
import { HttpError } from "@/lib/http-error";

export type GetTrelloAuthorizeUrlResponse = InferResponseType<
  (typeof client)["import"]["trello"]["authorize-url"][":workspaceId"]["$get"],
  200
>;

async function getTrelloAuthorizeUrl(
  workspaceId: string,
): Promise<GetTrelloAuthorizeUrlResponse> {
  const response = await client.import.trello["authorize-url"][
    ":workspaceId"
  ].$get({ param: { workspaceId } });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getTrelloAuthorizeUrl;
