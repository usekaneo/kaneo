import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono";
import { HttpError } from "@/lib/http-error";

export type GetImportRunsResponse = InferResponseType<
  (typeof client)["import"]["runs"][":workspaceId"]["$get"],
  200
>;

async function getImportRuns(
  workspaceId: string,
): Promise<GetImportRunsResponse> {
  const response = await client.import.runs[":workspaceId"].$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getImportRuns;
