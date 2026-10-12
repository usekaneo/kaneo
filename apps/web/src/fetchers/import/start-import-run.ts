import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";
import { HttpError } from "@/lib/http-error";

export type StartImportRunRequest = InferRequestType<
  (typeof client)["import"]["runs"]["$post"]
>["json"];

export type StartImportRunResponse = InferResponseType<
  (typeof client)["import"]["runs"]["$post"],
  202
>;

async function startImportRun(
  data: StartImportRunRequest,
): Promise<StartImportRunResponse> {
  const response = await client.import.runs.$post({ json: data });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default startImportRun;
